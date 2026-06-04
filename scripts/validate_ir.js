#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const defaultSemanticPath = path.join(root, "examples", "ai-image-home.semantic.json");
const defaultUIKitPath = path.join(root, "examples", "ai-image-home.uikit.json");
const defaultContractPath = fs.existsSync(path.join(root, "contracts", "uikit-mapping-contract.json"))
  ? path.join(root, "contracts", "uikit-mapping-contract.json")
  : path.join(root, "references", "uikit-mapping-contract.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const options = {
    semantic: defaultSemanticPath,
    uikit: defaultUIKitPath,
    contract: defaultContractPath
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      fail(`unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    if (!["semantic", "uikit", "contract"].includes(key)) {
      fail(`unknown option: ${arg}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`missing value for ${arg}`);
    }
    options[key] = path.resolve(process.cwd(), value);
    index += 1;
  }

  return options;
}

function fail(message) {
  throw new Error(message);
}

function assertArrayIncludesAll(actual, required, label) {
  const missing = required.filter((item) => !actual.includes(item));
  if (missing.length > 0) {
    fail(`${label} missing: ${missing.join(", ")}`);
  }
}

function hasOwnKeys(object, keys) {
  return Boolean(object) && keys.every((key) => Object.prototype.hasOwnProperty.call(object, key));
}

function tokenLike(value) {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9]*(\s*[+*]\s*[A-Za-z0-9]+)*$/.test(value);
}

function validateHeightMetric(metric, label) {
  if (!metric || typeof metric !== "object") {
    fail(`${label} requires height metric`);
  }
  const mode = metric.mode;
  const validModes = ["fixed", "min", "max", "intrinsic", "ratio", "aspectRatio", "fill"];
  if (!validModes.includes(mode)) {
    fail(`${label} has invalid height.mode`);
  }
  if (["fixed", "min", "max"].includes(mode) && typeof metric.value !== "number" && typeof metric.token !== "string") {
    fail(`${label} height.${mode} requires value or token`);
  }
  if (mode === "ratio" && typeof metric.ratio !== "number") {
    fail(`${label} height.ratio requires ratio`);
  }
  if (mode === "aspectRatio" && typeof metric.aspectRatio !== "string") {
    fail(`${label} height.aspectRatio requires aspectRatio`);
  }
}

function validateSlotMetrics(slotMetrics, slots, label) {
  if (!slotMetrics || typeof slotMetrics !== "object" || Object.keys(slotMetrics).length === 0) {
    fail(`${label} requires non-empty slotMetrics`);
  }

  for (const slot of slots) {
    const metric = slotMetrics[slot.name];
    if (!metric) {
      fail(`${label} missing slotMetrics.${slot.name}`);
    }
    validateHeightMetric(metric.height, `${label}.slotMetrics.${slot.name}`);
    if (slot.maxLines && metric.maxLines && metric.maxLines !== slot.maxLines) {
      fail(`${label}.slotMetrics.${slot.name}.maxLines must match contentStructure slot maxLines`);
    }
  }
}

function validateContract(contract) {
  if (!contract.defaults || !Array.isArray(contract.defaults.requiredScreenStates)) {
    fail("contract.defaults.requiredScreenStates is required");
  }
  if (!Array.isArray(contract.defaults.requiredNodeDetailFields) || contract.defaults.requiredNodeDetailFields.length === 0) {
    fail("contract.defaults.requiredNodeDetailFields is required");
  }
  if (!Array.isArray(contract.mappings) || contract.mappings.length === 0) {
    fail("contract.mappings must not be empty");
  }

  const seen = new Set();
  for (const mapping of contract.mappings) {
    for (const key of ["semanticType", "preferred", "fallbacks", "requiredStates", "requiredEvents", "layoutRules", "requiredDetailFields", "rejectWhen"]) {
      if (!(key in mapping)) {
        fail(`mapping ${mapping.semanticType || "<unknown>"} missing ${key}`);
      }
    }
    if (seen.has(mapping.semanticType)) {
      fail(`duplicate mapping semanticType: ${mapping.semanticType}`);
    }
    seen.add(mapping.semanticType);
  }
}

function validateSemanticIr(semantic, contract) {
  const screen = semantic.screen;
  if (!screen) fail("semantic.screen is required");
  if (screen.platform !== "ios") fail("semantic.screen.platform must be ios");
  assertArrayIncludesAll(screen.states || [], contract.defaults.requiredScreenStates, "screen.states");

  const mappings = new Map(contract.mappings.map((mapping) => [mapping.semanticType, mapping]));
  const reviewThreshold = contract.defaults.reviewConfidenceThreshold;
  const ids = new Set();

  for (const node of screen.nodes || []) {
    if (ids.has(node.id)) fail(`duplicate semantic node id: ${node.id}`);
    ids.add(node.id);

    const mapping = mappings.get(node.semanticType);
    if (!mapping) fail(`no mapping contract for semanticType: ${node.semanticType}`);

    if (typeof node.confidence !== "number" || node.confidence < 0 || node.confidence > 1) {
      fail(`node ${node.id} has invalid confidence`);
    }
    assertArrayIncludesAll(Object.keys(node), contract.defaults.requiredNodeDetailFields, `node ${node.id} detail fields`);
    if (node.confidence < reviewThreshold && (!Array.isArray(node.alternatives) || node.alternatives.length === 0)) {
      fail(`node ${node.id} confidence below threshold requires alternatives`);
    }

    assertArrayIncludesAll(node.states || [], mapping.requiredStates, `node ${node.id} states`);
    assertArrayIncludesAll(node.events || [], mapping.requiredEvents, `node ${node.id} events`);
    assertArrayIncludesAll(Object.keys(node), mapping.requiredDetailFields, `node ${node.id} mapping detail fields`);

    if (!hasOwnKeys(node.visualMetrics, ["padding", "spacing", "typography"])) {
      fail(`node ${node.id} visualMetrics requires padding, spacing, and typography`);
    }
    if (!hasOwnKeys(node.contentStructure, ["layoutPattern", "slots"]) || !Array.isArray(node.contentStructure.slots) || node.contentStructure.slots.length === 0) {
      fail(`node ${node.id} contentStructure requires layoutPattern and non-empty slots`);
    }
    validateSlotMetrics(node.slotMetrics, node.contentStructure.slots, `node ${node.id}`);

    if (node.semanticType.includes("input")) {
      const validation = node.data && node.data.validation;
      if (!validation || validation.required !== true || !validation.emptyMessage) {
        fail(`input node ${node.id} requires validation and emptyMessage`);
      }
      if (!node.visualMetrics.height || !node.visualMetrics.outerCornerRadius) {
        fail(`input node ${node.id} requires height and outerCornerRadius metrics`);
      }
    }

    if (["vertical_list", "horizontal_option_list"].includes(node.semanticType)) {
      if (!node.data || node.data.template !== true || !node.data.itemModel) {
        fail(`repeated node ${node.id} requires template=true and itemModel`);
      }
      if (!node.data.itemSize || typeof node.data.itemSize !== "object") {
        fail(`repeated node ${node.id} requires data.itemSize`);
      }
    }

    if (["primary_cta", "content_card", "hero_header"].includes(node.semanticType)) {
      if (!node.visualMetrics.outerCornerRadius) {
        fail(`node ${node.id} requires outerCornerRadius metric`);
      }
    }

    if (["primary_cta", "prompt_input", "horizontal_option_list"].includes(node.semanticType) && !node.visualMetrics.height) {
      fail(`node ${node.id} requires height metric`);
    }
  }
}

function validateUIKitIr(uikit, semantic, contract) {
  assertArrayIncludesAll(uikit.stateModel.states || [], contract.defaults.requiredScreenStates, "uikit.stateModel.states");

  const semanticById = new Map(semantic.screen.nodes.map((node) => [node.id, node]));
  const semanticIds = new Set(semantic.screen.nodes.map((node) => node.id));
  const mappedIds = new Set((uikit.components || []).map((component) => component.id));

  for (const id of semanticIds) {
    if (!mappedIds.has(id)) fail(`UIKit IR missing component for semantic node: ${id}`);
  }

  const regions = uikit.layout.regions || [];
  const fixedBottom = regions.find((region) => region.id === "fixedBottom" && region.position === "fixed_bottom");
  const scroll = regions.find((region) => region.type === "UIScrollView");
  if (!fixedBottom) fail("UIKit IR requires fixedBottom region for fixed bottom CTA");
  if (!scroll || !scroll.contentInsetBottom) fail("scroll region requires contentInsetBottom for fixed bottom controls");
  if (!tokenLike(scroll.contentInsetBottom)) fail("scroll.contentInsetBottom should be token expression, not raw pixels");

  for (const component of uikit.components || []) {
    const semanticNode = semanticById.get(component.id);
    if (!semanticNode) fail(`UIKit component ${component.id} has no matching semantic node`);
    if (!component.mappingReason) fail(`UIKit component ${component.id} requires mappingReason`);
    if (!component.layoutSpec || !component.visualSpec) {
      fail(`UIKit component ${component.id} requires layoutSpec and visualSpec`);
    }
    if (!hasOwnKeys(component.layoutSpec, ["height", "contentInsets", "interItemSpacing", "slotLayout"])) {
      fail(`UIKit component ${component.id} layoutSpec requires height, contentInsets, interItemSpacing, and slotLayout`);
    }
    validateSlotMetrics(component.layoutSpec.slotLayout, semanticNode.contentStructure.slots, `UIKit component ${component.id}.layoutSpec`);
    if (!hasOwnKeys(component.visualSpec, ["cornerRadius", "typography"])) {
      fail(`UIKit component ${component.id} visualSpec requires cornerRadius and typography`);
    }

    if (semanticNode.layoutIntent.position === "fixed_bottom" && component.parent !== "fixedBottom") {
      fail(`fixed bottom node ${component.id} must be parented to fixedBottom`);
    }

    if (semanticNode.semanticType === "vertical_list" && (!component.cellTemplate || !component.dataModel)) {
      fail(`vertical list ${component.id} requires cellTemplate and dataModel`);
    }

    if (semanticNode.semanticType === "prompt_input") {
      if (!component.validation || component.keyboardHandling !== true) {
        fail(`prompt input ${component.id} requires validation and keyboardHandling`);
      }
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const contract = readJson(options.contract);
  const semantic = readJson(options.semantic);
  const uikit = readJson(options.uikit);

  validateContract(contract);
  validateSemanticIr(semantic, contract);
  validateUIKitIr(uikit, semantic, contract);

  console.log("UI Design to Code UIKit workflow validation passed.");
  console.log(`semantic: ${path.relative(process.cwd(), options.semantic)}`);
  console.log(`uikit: ${path.relative(process.cwd(), options.uikit)}`);
  console.log(`contract: ${path.relative(process.cwd(), options.contract)}`);
}

main();

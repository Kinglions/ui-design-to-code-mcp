#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { writeSizes: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write-sizes") {
      options.writeSizes = true;
      continue;
    }
    if (arg === "--run") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail("missing value for --run");
      options.run = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    if (arg === "--adapters") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail("missing value for --adapters");
      options.adapters = path.resolve(process.cwd(), value);
      index += 1;
      continue;
    }
    fail(`unknown argument: ${arg}`);
  }
  if (!options.run) fail("--run is required");
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveInside(runRoot, relativePath) {
  const absolutePath = path.resolve(runRoot, relativePath);
  if (!isInside(runRoot, absolutePath)) {
    fail(`artifact path escapes run directory: ${relativePath}`);
  }
  return absolutePath;
}

function flattenSemanticNodes(nodes, output = []) {
  for (const node of nodes || []) {
    output.push(node);
    flattenSemanticNodes(node.children, output);
  }
  return output;
}

function loadArtifactMap(runRoot, manifest) {
  const artifactMap = new Map();
  let totalBytes = 0;
  const categoryBytes = {};

  for (const artifact of manifest.artifacts || []) {
    if (!artifact.id) fail("artifact missing id");
    if (artifactMap.has(artifact.id)) fail(`duplicate artifact id: ${artifact.id}`);
    if (!artifact.path) fail(`artifact ${artifact.id} missing path`);
    if (!artifact.category) fail(`artifact ${artifact.id} missing category`);
    if (!artifact.cleanupStatus) fail(`artifact ${artifact.id} missing cleanupStatus`);

    const artifactPath = resolveInside(runRoot, artifact.path);
    const shouldExist = !["deleted", "external"].includes(artifact.cleanupStatus);
    if (shouldExist && !fs.existsSync(artifactPath)) {
      fail(`artifact file missing: ${artifact.id} ${artifact.path}`);
    }

    let sizeBytes = 0;
    if (fs.existsSync(artifactPath)) {
      const stat = fs.statSync(artifactPath);
      sizeBytes = stat.isDirectory() ? 0 : stat.size;
      totalBytes += sizeBytes;
      categoryBytes[artifact.category] = (categoryBytes[artifact.category] || 0) + sizeBytes;
    }

    artifactMap.set(artifact.id, { manifest: artifact, path: artifactPath, sizeBytes });
  }

  return { artifactMap, totalBytes, categoryBytes };
}

function findArtifact(artifactMap, type) {
  for (const entry of artifactMap.values()) {
    if (entry.manifest.artifactType === type) return entry;
  }
  return null;
}

function readArtifact(artifactMap, type, required = true) {
  const entry = findArtifact(artifactMap, type);
  if (!entry) {
    if (required) fail(`missing artifactType in manifest: ${type}`);
    return null;
  }
  return readJson(entry.path);
}

function assertAllExist(ids, knownIds, label) {
  for (const id of ids || []) {
    if (!knownIds.has(id)) fail(`${label} references unknown id: ${id}`);
  }
}

function loadAdapterContract(skillRoot, adaptersDir, targetId, adapterContractPath) {
  const candidates = [];
  if (adapterContractPath) candidates.push(adapterContractPath);
  if (adapterContractPath) candidates.push(path.join(skillRoot, adapterContractPath));
  if (targetId) candidates.push(path.join(adaptersDir, `${targetId}.adapter-contract.json`));

  for (const candidate of candidates) {
    const absolutePath = path.resolve(candidate);
    if (fs.existsSync(absolutePath)) return readJson(absolutePath);
  }
  fail(`adapter contract not found for target: ${targetId}`);
}

function validateTraceability(skillRoot, adaptersDir, artifactMap) {
  const vision = readArtifact(artifactMap, "vision_ir");
  const compression = readArtifact(artifactMap, "node_compression_ir");
  const semantic = readArtifact(artifactMap, "platform_neutral_semantic_ui_ir");
  const cross = readArtifact(artifactMap, "cross_platform_node_data");
  const plan = readArtifact(artifactMap, "platform_conversion_plan");

  const primitiveIds = new Set((vision.primitives || []).map((primitive) => primitive.id));
  const groupIds = new Set((compression.groups || []).map((group) => group.id));
  const templateIds = new Set((compression.templates || []).map((template) => template.id));
  const semanticNodes = flattenSemanticNodes(semantic.nodeTree || []);
  const semanticIds = new Set(semanticNodes.map((node) => node.id));
  const crossNodeIds = new Set((cross.nodes || []).map((node) => node.id));

  if (primitiveIds.size === 0) fail("Vision IR must include primitives");
  if (groupIds.size === 0) fail("Node Compression IR must include groups");
  if (semanticIds.size === 0) fail("Semantic UI IR must include nodeTree");
  if (crossNodeIds.size === 0) fail("Cross-platform Node Data must include nodes");

  for (const group of compression.groups || []) {
    assertAllExist(group.primitiveIds, primitiveIds, `group ${group.id}.primitiveIds`);
    for (const slot of group.slotCandidates || []) {
      assertAllExist(slot.primitiveIds, primitiveIds, `group ${group.id}.slot ${slot.name}`);
    }
  }

  for (const template of compression.templates || []) {
    assertAllExist(template.instanceGroupIds, groupIds, `template ${template.id}.instanceGroupIds`);
  }

  for (const node of semanticNodes) {
    assertAllExist(node.sourceGroupIds, groupIds, `semantic node ${node.id}.sourceGroupIds`);
    for (const slot of node.contentStructure && node.contentStructure.slots ? node.contentStructure.slots : []) {
      if (!node.slotMetrics || !node.slotMetrics[slot.name]) {
        fail(`semantic node ${node.id} missing slotMetrics.${slot.name}`);
      }
    }
  }

  const semanticTypes = new Set();
  for (const node of cross.nodes || []) {
    const trace = node.traceability || {};
    if (!semanticIds.has(trace.semanticNodeId)) {
      fail(`cross-platform node ${node.id} references unknown semanticNodeId: ${trace.semanticNodeId}`);
    }
    assertAllExist(trace.sourceGroupIds || [], groupIds, `cross node ${node.id}.sourceGroupIds`);
    if (trace.sourcePrimitiveIds) {
      assertAllExist(trace.sourcePrimitiveIds, primitiveIds, `cross node ${node.id}.sourcePrimitiveIds`);
    }
    if (node.core && node.core.semanticType) semanticTypes.add(node.core.semanticType);
  }

  for (const target of plan.targets || []) {
    const contract = loadAdapterContract(skillRoot, adaptersDir, target.id, target.adapterContract);
    const supportedTypes = new Set((contract.semanticMappings || []).map((mapping) => mapping.semanticType));
    for (const semanticType of semanticTypes) {
      if (!supportedTypes.has(semanticType)) {
        fail(`target ${target.id} adapter does not support semanticType: ${semanticType}`);
      }
    }
    for (const mapping of target.componentMapping || []) {
      if (!crossNodeIds.has(mapping.nodeId)) {
        fail(`target ${target.id} componentMapping references unknown nodeId: ${mapping.nodeId}`);
      }
    }
    for (const mapping of target.layoutMapping || []) {
      if (!crossNodeIds.has(mapping.nodeId)) {
        fail(`target ${target.id} layoutMapping references unknown nodeId: ${mapping.nodeId}`);
      }
    }
    for (const asset of target.assetPlan || []) {
      if (!crossNodeIds.has(asset.sourceNodeId)) {
        fail(`target ${target.id} assetPlan references unknown sourceNodeId: ${asset.sourceNodeId}`);
      }
    }
  }

  return {
    primitives: primitiveIds.size,
    groups: groupIds.size,
    templates: templateIds.size,
    semanticNodes: semanticIds.size,
    crossPlatformNodes: crossNodeIds.size,
    targets: (plan.targets || []).length
  };
}

function maybeWriteSizes(manifestPath, manifest, artifactMap, totalBytes, categoryBytes) {
  manifest.sizeSummary = {
    totalBytes,
    categoryBytes
  };

  for (const artifact of manifest.artifacts || []) {
    const entry = artifactMap.get(artifact.id);
    if (entry && entry.sizeBytes > 0) artifact.sizeBytes = entry.sizeBytes;
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const skillRoot = path.resolve(__dirname, "..");
  const adaptersDir = options.adapters || path.join(skillRoot, "references", "platform-adapters");
  const runRoot = options.run;
  const manifestPath = path.join(runRoot, "artifact-run-manifest.json");

  if (!fs.existsSync(manifestPath)) fail(`missing manifest: ${manifestPath}`);
  const manifest = readJson(manifestPath);
  if (!manifest.run || manifest.run.skill !== "ui-design-to-code") {
    fail("manifest.run.skill must be ui-design-to-code");
  }

  const declaredRoot = manifest.run.root || ".";
  const manifestRoot = path.isAbsolute(declaredRoot)
    ? path.resolve(declaredRoot)
    : path.resolve(runRoot, declaredRoot);
  if (manifestRoot !== runRoot) fail("manifest run.root must match --run");

  const { artifactMap, totalBytes, categoryBytes } = loadArtifactMap(runRoot, manifest);
  const summary = validateTraceability(skillRoot, adaptersDir, artifactMap);

  if (options.writeSizes) {
    maybeWriteSizes(manifestPath, manifest, artifactMap, totalBytes, categoryBytes);
  }

  console.log("UI Design to Code pipeline validation passed.");
  console.log(`run: ${runRoot}`);
  console.log(`artifacts: ${artifactMap.size}`);
  console.log(`sizeBytes: ${totalBytes}`);
  console.log(`categoryBytes: ${JSON.stringify(categoryBytes)}`);
  console.log(`traceability: ${JSON.stringify(summary)}`);
}

main();

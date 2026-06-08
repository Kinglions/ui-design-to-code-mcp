#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function parseArgs(argv) {
  const options = { out: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) fail(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (!["run", "source", "vision", "compression", "semantic", "reference-analysis", "out"].includes(key)) {
      fail(`unknown option: ${arg}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`missing value for ${arg}`);
    options[key.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
    index += 1;
  }
  return options;
}

function artifactByType(manifest, artifactType) {
  return (manifest.artifacts || []).find((artifact) => artifact.artifactType === artifactType);
}

function resolveArtifact(runRoot, explicitPath, artifact) {
  if (explicitPath) return path.resolve(process.cwd(), explicitPath);
  if (!artifact || !artifact.path) return "";
  return path.resolve(runRoot, artifact.path);
}

function bboxLabel(bbox) {
  if (!bbox) return "<missing>";
  return `${bbox.x},${bbox.y},${bbox.width}x${bbox.height}`;
}

function isGenericName(value) {
  return /^(group|frame|rectangle|shape|layer|node)[\s_-]*\d*$/i.test(String(value || "").trim());
}

function bboxWithin(bounds, bbox) {
  return bbox
    && Number.isFinite(bbox.x)
    && Number.isFinite(bbox.y)
    && Number.isFinite(bbox.width)
    && Number.isFinite(bbox.height)
    && bbox.width >= 0
    && bbox.height >= 0
    && bbox.x >= bounds.x
    && bbox.y >= bounds.y
    && bbox.x + bbox.width <= bounds.x + bounds.width
    && bbox.y + bbox.height <= bounds.y + bounds.height;
}

function addFinding(findings, severity, code, message, detail = {}) {
  findings.push({ severity, code, message, detail });
}

function collectSemanticNodes(nodes, out = []) {
  for (const node of nodes || []) {
    out.push(node);
    collectSemanticNodes(node.children, out);
  }
  return out;
}

function requireFile(filePath, label) {
  if (!filePath || !fs.existsSync(filePath)) fail(`${label} not found: ${filePath || "<missing>"}`);
}

function sourceBounds(source) {
  const raw = source.source || source;
  const width = Number(raw.widthPx || raw.width || source.widthPx || source.width);
  const height = Number(raw.heightPx || raw.height || source.heightPx || source.height);
  if (!width || !height) fail("source image manifest must include widthPx and heightPx");
  return { x: 0, y: 0, width, height };
}

function auditReferenceAnalysis(reference, source, findings) {
  if (!reference) {
    addFinding(findings, "warning", "missing_reference_analysis", "Reference analysis artifact is missing; pre-decode structure, media, text, and risk audits are not captured.");
    return;
  }
  if (reference.artifactType !== "reference_analysis") {
    addFinding(findings, "error", "invalid_reference_analysis_type", "Reference analysis artifactType must be reference_analysis.");
  }
  const bounds = sourceBounds(source);
  const size = reference.originalPixelSize || {};
  if (size.width !== bounds.width || size.height !== bounds.height) {
    addFinding(findings, "error", "reference_size_mismatch", "Reference analysis originalPixelSize must match source image dimensions.", { expected: bounds, actual: size });
  }
  const rootFrame = reference.pageStructure && reference.pageStructure.rootFrame;
  if (!bboxWithin(bounds, rootFrame)) {
    addFinding(findings, "error", "reference_root_frame_bounds", "Reference rootFrame must be inside source image bounds.", { bbox: rootFrame, bounds });
  }
  const topLevelGroups = reference.pageStructure && reference.pageStructure.topLevelGroups || [];
  if (topLevelGroups.length === 0) {
    addFinding(findings, "error", "missing_top_level_groups", "Reference analysis must include semantic top-level groups.");
  }
  for (const group of topLevelGroups) {
    if (isGenericName(group.name)) {
      addFinding(findings, "warning", "generic_top_level_group_name", "Top-level group name should be semantic, not generic.", { id: group.id, name: group.name });
    }
    if (!bboxWithin(bounds, group.bbox)) {
      addFinding(findings, "error", "top_level_group_out_of_bounds", "Top-level group bbox must be inside source image bounds.", { id: group.id, bbox: group.bbox });
    }
  }
  const auditPlan = reference.auditPlan || {};
  for (const section of ["text", "media", "navigation", "structure", "transparentBounds"]) {
    if (!auditPlan[section] || !Array.isArray(auditPlan[section].checks) || auditPlan[section].checks.length === 0) {
      addFinding(findings, "warning", "incomplete_reference_audit_plan", `Reference audit plan should include checks for ${section}.`);
    }
  }
  if (reference.mode && reference.mode.strictExtraction) {
    if (!reference.mode.scaleFactor || !reference.mode.absolutePositioningRequired) {
      addFinding(findings, "error", "strict_mode_missing_scale", "Strict extraction mode requires scaleFactor and absolutePositioningRequired.");
    }
  }
}

function auditVision(vision, source, findings) {
  const bounds = sourceBounds(source);
  const primitiveIds = new Set();
  const textRuns = [];
  const imageRegions = [];
  for (const primitive of vision.primitives || []) {
    if (primitiveIds.has(primitive.id)) addFinding(findings, "error", "duplicate_primitive_id", "Vision primitive IDs must be unique.", { id: primitive.id });
    primitiveIds.add(primitive.id);
    if (!bboxWithin(bounds, primitive.bbox)) {
      addFinding(findings, "error", "primitive_out_of_bounds", "Vision primitive bbox must be inside source image bounds.", { id: primitive.id, bbox: primitive.bbox, bounds });
    }
    if (primitive.type === "text_run") {
      textRuns.push(primitive);
      if (!primitive.content || typeof primitive.content.text !== "string") {
        addFinding(findings, "error", "text_run_missing_text", "Text primitives must include OCR text content.", { id: primitive.id });
      }
      if (!primitive.style || !primitive.style.fontSize || !primitive.style.lineHeight) {
        addFinding(findings, "warning", "text_run_missing_metrics", "Text primitives should include fontSize and lineHeight for text overflow audit.", { id: primitive.id });
      }
    }
    if (primitive.type === "image_region") imageRegions.push(primitive);
    if (primitive.type === "icon_candidate" && primitive.bbox && (primitive.bbox.width > bounds.width * 0.5 || primitive.bbox.height > bounds.height * 0.5)) {
      addFinding(findings, "warning", "large_icon_candidate_bounds", "Icon candidates should be cropped near visible glyph bounds.", { id: primitive.id, bbox: primitive.bbox });
    }
  }
  if (textRuns.length === 0) {
    addFinding(findings, "warning", "no_text_runs", "Vision IR has no text_run primitives; confirm the reference image has no visible text.");
  }
  return { primitiveIds, textRuns, imageRegions };
}

function auditCompression(compression, primitiveIds, findings) {
  const groupIds = new Set();
  for (const group of compression.groups || []) {
    if (groupIds.has(group.id)) addFinding(findings, "error", "duplicate_group_id", "Compression group IDs must be unique.", { id: group.id });
    groupIds.add(group.id);
    for (const primitiveId of group.primitiveIds || []) {
      if (!primitiveIds.has(primitiveId)) addFinding(findings, "error", "unknown_group_primitive", "Compression group references unknown primitive.", { groupId: group.id, primitiveId });
    }
    if (["button", "card", "input", "list_item", "navigation_item", "media_block", "tab_bar"].includes(group.candidateType) && (!group.slotCandidates || group.slotCandidates.length === 0)) {
      addFinding(findings, "error", "semantic_group_missing_slots", "Interactive/content groups must include slotCandidates.", { groupId: group.id, candidateType: group.candidateType });
    }
    for (const slot of group.slotCandidates || []) {
      for (const primitiveId of slot.primitiveIds || []) {
        if (!primitiveIds.has(primitiveId)) addFinding(findings, "error", "unknown_slot_primitive", "Slot candidate references unknown primitive.", { groupId: group.id, slot: slot.name, primitiveId });
      }
    }
  }
  for (const template of compression.templates || []) {
    if (!template.itemSize || !template.itemSize.width || !template.itemSize.height) {
      addFinding(findings, "error", "template_missing_item_size", "Repeated templates must include itemSize.", { templateId: template.id });
    }
    if (!template.slotCandidates || template.slotCandidates.length === 0) {
      addFinding(findings, "warning", "template_missing_slots", "Repeated templates should preserve slotCandidates.", { templateId: template.id });
    }
    for (const groupId of template.instanceGroupIds || []) {
      if (!groupIds.has(groupId)) addFinding(findings, "error", "unknown_template_group", "Template references unknown group.", { templateId: template.id, groupId });
    }
  }
  return groupIds;
}

function auditSemantic(semantic, groupIds, findings) {
  const nodes = collectSemanticNodes(semantic.nodeTree || []);
  if (nodes.length === 0) addFinding(findings, "error", "missing_semantic_nodes", "Semantic UI IR must include nodeTree.");
  for (const node of nodes) {
    if (isGenericName(node.id) || isGenericName(node.role)) {
      addFinding(findings, "warning", "generic_semantic_name", "Semantic nodes should use meaningful IDs and roles.", { id: node.id, role: node.role });
    }
    for (const groupId of node.sourceGroupIds || []) {
      if (!groupIds.has(groupId)) addFinding(findings, "error", "unknown_semantic_group", "Semantic node references unknown compression group.", { nodeId: node.id, groupId });
    }
    const slots = node.contentStructure && node.contentStructure.slots || [];
    for (const slot of slots) {
      const metric = node.slotMetrics && node.slotMetrics[slot.name];
      if (!metric) {
        addFinding(findings, "error", "missing_semantic_slot_metric", "Semantic node slot is missing slotMetrics.", { nodeId: node.id, slot: slot.name });
      }
      if (slot.maxLines === 1 && metric && metric.maxLines && metric.maxLines !== 1) {
        addFinding(findings, "warning", "single_line_slot_wrap_risk", "Single-line slots must preserve maxLines=1.", { nodeId: node.id, slot: slot.name });
      }
    }
    if (node.confidence < 0.8 && (!Array.isArray(node.alternatives) || node.alternatives.length === 0)) {
      addFinding(findings, "warning", "low_confidence_without_alternatives", "Low-confidence semantic nodes should include alternatives.", { nodeId: node.id, confidence: node.confidence });
    }
    if (node.semanticType === "bottom_navigation") {
      const navSlots = new Set(slots.map((slot) => slot.name));
      if (!navSlots.has("items") && slots.length < 2) {
        addFinding(findings, "warning", "bottom_navigation_missing_items", "Bottom navigation should preserve tab item slots and active/inactive state.");
      }
    }
    if ((node.semanticType || "").includes("input")) {
      const validation = node.validation || node.dataHints && node.dataHints.validation || node.data && node.data.validation;
      if (!validation) addFinding(findings, "warning", "input_missing_validation", "Input nodes should include validation and error behavior.", { nodeId: node.id });
    }
  }
}

function auditRun(options) {
  const runRoot = path.resolve(process.cwd(), options.run || ".");
  const manifestPath = path.join(runRoot, "artifact-run-manifest.json");
  requireFile(manifestPath, "artifact-run-manifest.json");
  const manifest = readJson(manifestPath);
  const sourcePath = resolveArtifact(runRoot, options.source, artifactByType(manifest, "source_image_manifest"));
  const visionPath = resolveArtifact(runRoot, options.vision, artifactByType(manifest, "vision_ir"));
  const compressionPath = resolveArtifact(runRoot, options.compression, artifactByType(manifest, "node_compression_ir"));
  const semanticPath = resolveArtifact(runRoot, options.semantic, artifactByType(manifest, "platform_neutral_semantic_ui_ir"));
  const referencePath = resolveArtifact(runRoot, options.referenceAnalysis, artifactByType(manifest, "reference_analysis"));

  requireFile(sourcePath, "source image manifest");
  requireFile(visionPath, "Vision IR");
  requireFile(compressionPath, "Node Compression IR");
  requireFile(semanticPath, "Semantic UI IR");

  const source = readJson(sourcePath);
  const vision = readJson(visionPath);
  const compression = readJson(compressionPath);
  const semantic = readJson(semanticPath);
  const reference = referencePath && fs.existsSync(referencePath) ? readJson(referencePath) : null;
  const findings = [];

  auditReferenceAnalysis(reference, source, findings);
  const { primitiveIds } = auditVision(vision, source, findings);
  const groupIds = auditCompression(compression, primitiveIds, findings);
  auditSemantic(semantic, groupIds, findings);

  const status = findings.some((finding) => finding.severity === "error") ? "failed" : "passed";
  const result = {
    artifactType: "image_decoding_audit",
    status,
    runRoot,
    checkedArtifacts: {
      sourceImageManifest: sourcePath,
      referenceAnalysis: referencePath || null,
      visionIr: visionPath,
      nodeCompressionIr: compressionPath,
      semanticUiIr: semanticPath
    },
    summary: {
      errors: findings.filter((finding) => finding.severity === "error").length,
      warnings: findings.filter((finding) => finding.severity === "warning").length
    },
    findings
  };
  if (options.out) writeJson(path.resolve(runRoot, options.out), result);
  return result;
}

try {
  const result = auditRun(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "passed") process.exit(1);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

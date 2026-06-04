#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const skillRoot = path.resolve(__dirname, "..");

function fail(message) {
  throw new Error(message);
}

function nowIso() {
  return new Date().toISOString();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function timestamp() {
  const date = new Date();
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function slugify(value) {
  return String(value || "design-run")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "design-run";
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveRunRoot(runRoot) {
  const root = path.resolve(String(runRoot || ""));
  if (!root) fail("runRoot is required");
  return root;
}

function resolveInside(runRoot, relativePath) {
  const absolutePath = path.resolve(runRoot, relativePath);
  if (!isInside(runRoot, absolutePath)) fail(`path escapes run directory: ${relativePath}`);
  return absolutePath;
}

function loadManifest(runRoot) {
  const manifestPath = path.join(runRoot, "artifact-run-manifest.json");
  if (!fs.existsSync(manifestPath)) fail(`missing artifact-run-manifest.json in ${runRoot}`);
  return { manifestPath, manifest: readJson(manifestPath) };
}

function upsertArtifact(manifest, artifact) {
  const artifacts = manifest.artifacts || [];
  const index = artifacts.findIndex((entry) => entry.id === artifact.id);
  if (index >= 0) artifacts[index] = { ...artifacts[index], ...artifact };
  else artifacts.push(artifact);
  manifest.artifacts = artifacts;
  manifest.run.updatedAt = nowIso();
}

function inferImageSize(imagePath) {
  const absolutePath = path.resolve(String(imagePath || ""));
  if (!fs.existsSync(absolutePath)) fail(`image does not exist: ${absolutePath}`);
  const result = spawnSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", absolutePath], {
    encoding: "utf8"
  });
  if (result.status !== 0) return null;
  const widthMatch = result.stdout.match(/pixelWidth:\s*(\d+)/);
  const heightMatch = result.stdout.match(/pixelHeight:\s*(\d+)/);
  if (!widthMatch || !heightMatch) return null;
  return { widthPx: Number(widthMatch[1]), heightPx: Number(heightMatch[1]) };
}

function sourceCoordinateSpacesForImage(widthPx, heightPx, logicalUnit = "unknown") {
  return {
    sourcePixel: {
      available: true,
      origin: "top_left",
      unit: "px",
      bounds: { x: 0, y: 0, width: widthPx, height: heightPx }
    },
    figmaCanvas: { available: false },
    logical: {
      available: logicalUnit !== "unknown",
      unit: logicalUnit,
      scaleFromSourcePx: logicalUnit === "unknown" ? 0 : 1,
      confidence: logicalUnit === "unknown" ? 0 : 0.5
    }
  };
}

function collectFigmaNodes(node, parentId = null, output = []) {
  if (!node || typeof node !== "object") return output;
  const id = String(node.id || node.nodeId || node.name || `node-${output.length + 1}`);
  const bbox = node.absoluteBoundingBox || node.absoluteRenderBounds || node.bbox || null;
  const children = Array.isArray(node.children) ? node.children : [];
  output.push({
    id,
    parentId,
    type: String(node.type || "UNKNOWN"),
    name: String(node.name || id),
    bbox: bbox
      ? {
          x: Number(bbox.x || 0),
          y: Number(bbox.y || 0),
          width: Number(bbox.width || 0),
          height: Number(bbox.height || 0)
        }
      : undefined,
    visible: node.visible !== false,
    text: typeof node.characters === "string" ? node.characters : undefined,
    style: node.style || undefined,
    layout: {
      layoutMode: node.layoutMode,
      primaryAxisSizingMode: node.primaryAxisSizingMode,
      counterAxisSizingMode: node.counterAxisSizingMode,
      itemSpacing: node.itemSpacing,
      paddingLeft: node.paddingLeft,
      paddingRight: node.paddingRight,
      paddingTop: node.paddingTop,
      paddingBottom: node.paddingBottom
    },
    effects: Array.isArray(node.effects) ? node.effects : undefined,
    component: node.componentId || node.componentProperties
      ? { componentId: node.componentId, componentProperties: node.componentProperties }
      : undefined,
    children: children.map((child) => String(child.id || child.nodeId || child.name || "unknown"))
  });
  for (const child of children) collectFigmaNodes(child, id, output);
  return output;
}

function output(content) {
  return {
    content: [{ type: "text", text: typeof content === "string" ? content : JSON.stringify(content, null, 2) }]
  };
}

function createDesignRun(args) {
  const workspace = path.resolve(String(args.workspace || process.cwd()));
  const mode = String(args.mode || "decode-only");
  const slug = slugify(args.slug || args.sourceName || "design");
  const root = args.useTmp
    ? path.join("/private/tmp/ui-design-to-code", `${timestamp()}-${slug}`)
    : path.join(workspace, "generated", "ui-design-to-code", `${timestamp()}-${slug}`);
  mkdirp(root);
  for (const dir of ["source", "figma", "vision", "compression", "semantic", "cross-platform", "targets", "review"]) {
    mkdirp(path.join(root, dir));
  }
  const manifest = {
    artifactType: "artifact_run_manifest",
    run: {
      id: path.basename(root),
      skill: "ui-design-to-code",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      root,
      sourceSummary: args.sourceSummary || "",
      mode,
      targets: Array.isArray(args.targets) ? args.targets : []
    },
    retention: {
      defaultIntermediateTtlHours: 168,
      defaultDebugTtlHours: 24,
      cleanupPolicy: "dry_run_required"
    },
    artifacts: []
  };
  writeJson(path.join(root, "artifact-run-manifest.json"), manifest);
  return output({ runRoot: root, manifestPath: path.join(root, "artifact-run-manifest.json"), mode });
}

function ingestImageSource(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const { manifestPath, manifest } = loadManifest(runRoot);
  const imagePath = path.resolve(String(args.imagePath || ""));
  if (!fs.existsSync(imagePath)) fail(`imagePath does not exist: ${imagePath}`);
  const inferred = inferImageSize(imagePath) || {};
  const widthPx = Number(args.widthPx || inferred.widthPx);
  const heightPx = Number(args.heightPx || inferred.heightPx);
  if (!widthPx || !heightPx) fail("widthPx and heightPx are required when image size cannot be inferred");
  const sourceId = String(args.sourceId || "source-image");
  const designSourcePath = "source/design-source-manifest.json";
  const imageManifestPath = "source/page.source-manifest.json";

  const designSource = {
    artifactType: "design_source_manifest",
    source: {
      id: sourceId,
      sourceKind: "image",
      name: args.name || path.basename(imagePath),
      createdAt: nowIso()
    },
    inputs: {
      image: {
        path: imagePath,
        widthPx,
        heightPx,
        colorSpace: args.colorSpace || "unknown"
      }
    },
    coordinateSpaces: sourceCoordinateSpacesForImage(widthPx, heightPx, args.logicalUnit || "unknown"),
    uncertainties: args.uncertainties || []
  };

  const imageManifest = {
    source: {
      id: sourceId,
      path: imagePath,
      widthPx,
      heightPx,
      colorSpace: args.colorSpace || "unknown",
      pixelDensity: {
        scale: Number(args.pixelScale || 1),
        unit: args.pixelUnit || "unknown",
        confidence: args.pixelScale ? 0.6 : 0
      }
    },
    coordinateSpaces: {
      sourcePixel: { origin: "top_left", unit: "px", bounds: { x: 0, y: 0, width: widthPx, height: heightPx } },
      normalized: { origin: "top_left", range: "0_to_1" },
      logical: {
        unit: args.logicalUnit || "unknown",
        scaleFromSourcePx: args.logicalUnit && args.logicalUnit !== "unknown" ? 1 : 0,
        confidence: args.logicalUnit && args.logicalUnit !== "unknown" ? 0.5 : 0,
        evidence: args.logicalUnit && args.logicalUnit !== "unknown" ? ["provided to MCP ingest_image_source"] : []
      }
    },
    knownViewport: args.knownViewport || {},
    uncertainties: args.uncertainties || []
  };

  writeJson(resolveInside(runRoot, designSourcePath), designSource);
  writeJson(resolveInside(runRoot, imageManifestPath), imageManifest);
  upsertArtifact(manifest, {
    id: "design-source",
    path: designSourcePath,
    category: "source",
    artifactType: "design_source_manifest",
    cleanupStatus: "keep"
  });
  upsertArtifact(manifest, {
    id: "source-image-manifest",
    path: imageManifestPath,
    category: "source",
    artifactType: "source_image_manifest",
    cleanupStatus: "keep"
  });
  writeJson(manifestPath, manifest);
  return output({ designSourcePath: path.join(runRoot, designSourcePath), imageManifestPath: path.join(runRoot, imageManifestPath) });
}

function ingestFigmaSource(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const { manifestPath, manifest } = loadManifest(runRoot);
  const sourceId = String(args.sourceId || "figma-source");
  const figma = args.figma || {};
  let rawNode = args.nodeJson || null;
  if (!rawNode && args.nodeJsonPath) rawNode = readJson(path.resolve(String(args.nodeJsonPath)));
  const nodes = rawNode ? collectFigmaNodes(rawNode.document || rawNode.node || rawNode) : [];
  const screenshotPath = args.screenshotPath ? path.resolve(String(args.screenshotPath)) : figma.screenshotPath;
  const imageSize = screenshotPath && fs.existsSync(screenshotPath) ? inferImageSize(screenshotPath) : null;
  const sourceKind = rawNode && screenshotPath ? "hybrid" : rawNode ? "figma" : "image";
  const boundsNode = nodes.find((node) => node.bbox);
  const figmaBounds = args.figmaBounds || (boundsNode && boundsNode.bbox) || null;
  const designSourcePath = "source/design-source-manifest.json";
  const datasetPath = "figma/figma-source-dataset.json";

  const designSource = {
    artifactType: "design_source_manifest",
    source: {
      id: sourceId,
      sourceKind,
      name: args.name || figma.name || "Figma source",
      createdAt: nowIso()
    },
    inputs: {
      image: screenshotPath
        ? {
            path: screenshotPath,
            widthPx: imageSize && imageSize.widthPx,
            heightPx: imageSize && imageSize.heightPx,
            colorSpace: "unknown"
          }
        : undefined,
      figma: {
        fileKey: figma.fileKey,
        nodeId: figma.nodeId,
        frameId: figma.frameId,
        nodeJsonPath: args.nodeJsonPath ? path.resolve(String(args.nodeJsonPath)) : undefined,
        screenshotPath,
        source: figma.source || "figma_mcp"
      }
    },
    coordinateSpaces: {
      sourcePixel: imageSize
        ? { available: true, origin: "top_left", unit: "px", bounds: { x: 0, y: 0, width: imageSize.widthPx, height: imageSize.heightPx } }
        : { available: false },
      figmaCanvas: figmaBounds
        ? { available: true, origin: "top_left", unit: "figma_px", bounds: figmaBounds }
        : { available: nodes.length > 0, origin: "top_left", unit: "figma_px" },
      logical: { available: false, unit: "unknown", confidence: 0 },
      figmaToSourcePixel: imageSize && figmaBounds && figmaBounds.width && figmaBounds.height
        ? {
            available: true,
            scaleX: imageSize.widthPx / figmaBounds.width,
            scaleY: imageSize.heightPx / figmaBounds.height,
            offsetX: -figmaBounds.x,
            offsetY: -figmaBounds.y,
            confidence: 0.75,
            evidence: ["computed from Figma bounds and screenshot dimensions"]
          }
        : { available: false }
    },
    uncertainties: args.uncertainties || (rawNode ? [] : ["Figma node JSON was not provided"])
  };

  const dataset = {
    artifactType: "figma_source_dataset",
    sourceId,
    figma: {
      fileKey: figma.fileKey,
      nodeId: figma.nodeId,
      frameId: figma.frameId,
      source: figma.source || "figma_mcp",
      screenshotPath
    },
    coordinateSpace: {
      name: "figma_canvas",
      origin: "top_left",
      unit: "figma_px",
      bounds: figmaBounds || { x: 0, y: 0, width: 0, height: 0 }
    },
    nodes,
    traceability: {
      figmaNodeIds: nodes.map((node) => node.id),
      sourceScreenshotPrimitiveIds: []
    },
    uncertainties: args.uncertainties || []
  };

  writeJson(resolveInside(runRoot, designSourcePath), designSource);
  writeJson(resolveInside(runRoot, datasetPath), dataset);
  upsertArtifact(manifest, {
    id: "design-source",
    path: designSourcePath,
    category: "source",
    artifactType: "design_source_manifest",
    cleanupStatus: "keep"
  });
  upsertArtifact(manifest, {
    id: "figma-source-dataset",
    path: datasetPath,
    category: "source",
    artifactType: "figma_source_dataset",
    cleanupStatus: "keep"
  });
  writeJson(manifestPath, manifest);
  return output({ designSourcePath: path.join(runRoot, designSourcePath), figmaDatasetPath: path.join(runRoot, datasetPath), nodeCount: nodes.length, sourceKind });
}

function runScript(scriptName, args) {
  const result = spawnSync(process.execPath, [path.join(skillRoot, "scripts", scriptName), ...args], {
    encoding: "utf8"
  });
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function validatePipeline(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const result = runScript("validate_pipeline.js", ["--run", runRoot]);
  if (result.exitCode !== 0) fail(result.stderr || result.stdout || "validate_pipeline failed");
  return output(result);
}

function cleanupDesignRun(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const scriptArgs = ["--run", runRoot];
  if (args.apply) scriptArgs.push("--apply");
  const result = runScript("cleanup_artifacts.js", scriptArgs);
  if (result.exitCode !== 0) fail(result.stderr || result.stdout || "cleanup_artifacts failed");
  return output(result);
}

function registerArtifact(args, defaults) {
  const runRoot = resolveRunRoot(args.runRoot);
  const { manifestPath, manifest } = loadManifest(runRoot);
  const artifactPath = String(args.artifactPath || "");
  if (!artifactPath) {
    return output({
      status: "model_required",
      message: defaults.missingMessage,
      schemaPath: defaults.schemaPath && path.join(skillRoot, defaults.schemaPath),
      referencePath: defaults.referencePath && path.join(skillRoot, defaults.referencePath)
    });
  }
  const absolutePath = path.resolve(artifactPath);
  if (!fs.existsSync(absolutePath)) fail(`artifactPath does not exist: ${absolutePath}`);
  const relativePath = isInside(runRoot, absolutePath)
    ? path.relative(runRoot, absolutePath)
    : artifactPath;
  upsertArtifact(manifest, {
    id: args.artifactId || defaults.id,
    path: relativePath,
    category: args.category || defaults.category,
    artifactType: args.artifactType || defaults.artifactType,
    target: args.target,
    cleanupStatus: args.cleanupStatus || defaults.cleanupStatus || "keep"
  });
  writeJson(manifestPath, manifest);
  return output({ status: "registered", artifactPath: absolutePath, artifactId: args.artifactId || defaults.id });
}

function buildSemanticIr(args) {
  return registerArtifact(args, {
    id: "semantic-ui-ir",
    artifactType: "platform_neutral_semantic_ui_ir",
    category: "final",
    cleanupStatus: "keep",
    schemaPath: "references/platform-neutral-semantic-ui-ir.schema.json",
    referencePath: "references/vision-to-semantic-ir.md",
    missingMessage: "Generate or provide Platform-neutral Semantic UI IR, then call build_semantic_ir with artifactPath to register it."
  });
}

function buildCrossPlatformNodes(args) {
  return registerArtifact(args, {
    id: "cross-platform-node-data",
    artifactType: "cross_platform_node_data",
    category: "final",
    cleanupStatus: "keep",
    schemaPath: "references/cross-platform-node-data.schema.json",
    referencePath: "references/cross-platform-conversion-workflow.md",
    missingMessage: "Generate or provide Cross-platform Node Data, then call build_cross_platform_nodes with artifactPath to register it."
  });
}

function buildTargetIr(args) {
  const target = String(args.target || "target");
  return registerArtifact(args, {
    id: `${target}-target-layout`,
    artifactType: args.artifactType || "target_layout_ir",
    category: "final",
    cleanupStatus: "keep",
    schemaPath: target.includes("android")
      ? "references/target-layout-android-compose.schema.json"
      : target.includes("ios")
        ? "references/target-layout-ios-swiftui.schema.json"
        : "references/target-layout-web-react.schema.json",
    referencePath: "references/cross-platform-conversion-workflow.md",
    missingMessage: "Generate or provide target layout IR, then call build_target_ir with target and artifactPath to register it."
  });
}

function runCodegen(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const { manifestPath, manifest } = loadManifest(runRoot);
  const resultPath = "review/codegen-result.json";
  const result = {
    artifactType: "codegen_result",
    mode: "codegen",
    target: args.target,
    changedFiles: args.changedFiles || [],
    validation: args.validation || {},
    cleanupRequired: true,
    createdAt: nowIso()
  };
  writeJson(resolveInside(runRoot, resultPath), result);
  upsertArtifact(manifest, {
    id: "codegen-result",
    path: resultPath,
    category: "review",
    artifactType: "codegen_result",
    target: args.target,
    cleanupStatus: "keep"
  });
  writeJson(manifestPath, manifest);
  return output({ status: "recorded", resultPath: path.join(runRoot, resultPath) });
}

function runCodegenWithAutoReview(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const reviewPath = args.visualReviewResultPath ? path.resolve(String(args.visualReviewResultPath)) : null;
  let deliverable = false;
  let similarity = null;
  if (reviewPath) {
    if (!fs.existsSync(reviewPath)) fail(`visualReviewResultPath does not exist: ${reviewPath}`);
    const review = readJson(reviewPath);
    const comparisons = review.comparisons || [];
    const similarities = comparisons
      .map((comparison) => comparison.metrics && comparison.metrics.similarity)
      .filter((value) => Number.isFinite(value));
    similarity = similarities.length ? Math.min(...similarities) : null;
    deliverable = review.status === "passed" && similarity !== null && similarity >= 0.9;
  }
  const codegen = runCodegen({ ...args, validation: args.validation || {} });
  const { manifestPath, manifest } = loadManifest(runRoot);
  const resultPath = "review/codegen-with-auto-review-result.json";
  const result = {
    artifactType: "codegen_with_auto_review_result",
    mode: "codegen-with-auto-review",
    target: args.target,
    visualReviewResultPath: reviewPath,
    nonMaterialSimilarity: similarity,
    deliverable,
    rule: "deliverable only when visual review passed and non-material similarity >= 0.9",
    createdAt: nowIso()
  };
  writeJson(resolveInside(runRoot, resultPath), result);
  upsertArtifact(manifest, {
    id: "codegen-with-auto-review-result",
    path: resultPath,
    category: "review",
    artifactType: "codegen_with_auto_review_result",
    target: args.target,
    cleanupStatus: "keep"
  });
  writeJson(manifestPath, manifest);
  return output({ status: deliverable ? "deliverable" : "blocked_or_pending", codegen, resultPath: path.join(runRoot, resultPath), nonMaterialSimilarity: similarity });
}

const tools = {
  create_design_run: {
    description: "Create a ui-design-to-code run directory and artifact manifest.",
    inputSchema: {
      type: "object",
      properties: {
        workspace: { type: "string" },
        slug: { type: "string" },
        mode: { type: "string" },
        targets: { type: "array", items: { type: "string" } },
        sourceSummary: { type: "string" },
        useTmp: { type: "boolean" }
      }
    },
    handler: createDesignRun
  },
  ingest_image_source: {
    description: "Ingest screenshot/image input into Design Source Manifest and Source Image Manifest.",
    inputSchema: {
      type: "object",
      required: ["runRoot", "imagePath"],
      properties: {
        runRoot: { type: "string" },
        imagePath: { type: "string" },
        sourceId: { type: "string" },
        widthPx: { type: "number" },
        heightPx: { type: "number" },
        logicalUnit: { type: "string" },
        knownViewport: { type: "object" }
      }
    },
    handler: ingestImageSource
  },
  ingest_figma_source: {
    description: "Ingest Figma MCP node JSON, optional screenshot, or both into shared source artifacts.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: {
        runRoot: { type: "string" },
        sourceId: { type: "string" },
        figma: { type: "object" },
        nodeJson: { type: "object" },
        nodeJsonPath: { type: "string" },
        screenshotPath: { type: "string" },
        figmaBounds: { type: "object" }
      }
    },
    handler: ingestFigmaSource
  },
  validate_pipeline: {
    description: "Validate existing ui-design-to-code cross-artifact pipeline output.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: { runRoot: { type: "string" } }
    },
    handler: validatePipeline
  },
  cleanup_design_run: {
    description: "Run cleanup_artifacts.js for a design run. Dry-run by default.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: { runRoot: { type: "string" }, apply: { type: "boolean" } }
    },
    handler: cleanupDesignRun
  },
  build_semantic_ir: {
    description: "Register model-generated Platform-neutral Semantic UI IR or return the required schema/prompt contract.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: { runRoot: { type: "string" }, artifactPath: { type: "string" }, artifactId: { type: "string" } }
    },
    handler: buildSemanticIr
  },
  build_cross_platform_nodes: {
    description: "Register model-generated Cross-platform Node Data or return the required schema contract.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: { runRoot: { type: "string" }, artifactPath: { type: "string" }, artifactId: { type: "string" } }
    },
    handler: buildCrossPlatformNodes
  },
  build_target_ir: {
    description: "Register target-platform layout IR or return the required target schema contract.",
    inputSchema: {
      type: "object",
      required: ["runRoot", "target"],
      properties: { runRoot: { type: "string" }, target: { type: "string" }, artifactPath: { type: "string" }, artifactId: { type: "string" }, artifactType: { type: "string" } }
    },
    handler: buildTargetIr
  },
  run_codegen: {
    description: "Record codegen outputs and normal project validation summary for plain codegen mode.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: { runRoot: { type: "string" }, target: { type: "string" }, changedFiles: { type: "array", items: { type: "string" } }, validation: { type: "object" } }
    },
    handler: runCodegen
  },
  run_codegen_with_auto_review: {
    description: "Record codegen-with-auto-review result and enforce the >=0.9 non-material similarity delivery gate when a visual review result is provided.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: { runRoot: { type: "string" }, target: { type: "string" }, changedFiles: { type: "array", items: { type: "string" } }, validation: { type: "object" }, visualReviewResultPath: { type: "string" } }
    },
    handler: runCodegenWithAutoReview
  }
};

function toolList() {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));
}

function handleRequest(request) {
  if (request.method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "ui-design-to-code", version: "1.0.0" }
    };
  }
  if (request.method === "tools/list") return { tools: toolList() };
  if (request.method === "tools/call") {
    const name = request.params && request.params.name;
    const tool = tools[name];
    if (!tool) fail(`unknown tool: ${name}`);
    return tool.handler((request.params && request.params.arguments) || {});
  }
  return {};
}

function writeResponse(response) {
  const payload = JSON.stringify(response);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`);
}

function processRequestPayload(payload) {
  let response;
  try {
    const request = JSON.parse(payload);
    if (!request.id && request.method && request.method.startsWith("notifications/")) return;
    response = {
      jsonrpc: "2.0",
      id: request.id,
      result: handleRequest(request)
    };
  } catch (error) {
    response = {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: error.message }
    };
  }
  writeResponse(response);
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
  while (buffer.length > 0) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd >= 0) {
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) return;
      const payload = buffer.slice(bodyStart, bodyStart + length).toString("utf8");
      buffer = buffer.slice(bodyStart + length);
      processRequestPayload(payload);
      continue;
    }

    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex < 0) return;
    const line = buffer.slice(0, newlineIndex).toString("utf8").trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) processRequestPayload(line);
  }
});

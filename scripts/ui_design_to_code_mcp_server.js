#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const {
  downloadToFile,
  fetchFigmaJson,
  fetchFigmaMeta,
  fetchFigmaComments,
  fetchImageFillMap,
  fetchRenderedImages,
  normalizeNodeId,
  parseFigmaUrl,
  resolveApiToken,
  resolveApiTokenInfo,
  sanitizeFileKey,
  writeJson: writeHelperJson
} = require("./figma_rest_api");

const skillRoot = path.resolve(__dirname, "..");
const packageInfo = require(path.join(skillRoot, "package.json"));
const runModes = [
  {
    id: "decode-only",
    label: "Decode only",
    targetRequired: false,
    description: "Parse the design source into source manifests, Vision IR, Node Compression IR, and Platform-neutral Semantic UI IR. No platform plan or code."
  },
  {
    id: "plan-only",
    label: "Plan only",
    targetRequired: false,
    description: "Add Cross-platform Node Data and platform conversion planning. No target layout IR or code."
  },
  {
    id: "target-ir",
    label: "Target IR",
    targetRequired: true,
    description: "Generate target-platform layout IR for selected platforms. No code changes."
  },
  {
    id: "codegen",
    label: "Codegen",
    targetRequired: true,
    description: "Generate or modify target-platform code and run normal project validation. Runtime screenshot review is optional."
  },
  {
    id: "codegen-with-auto-review",
    label: "Codegen with auto review",
    targetRequired: true,
    description: "Run codegen, then browser/simulator/emulator screenshot review. Non-material UI similarity must be >= 0.9 before delivery."
  },
  {
    id: "runtime-review",
    label: "Runtime review",
    targetRequired: true,
    description: "Run an existing implementation, capture runtime screenshots, and compare against the source image. No code changes unless explicitly requested later."
  }
];

const runModeIds = new Set(runModes.map((mode) => mode.id));
const targetRequiredModes = new Set(runModes.filter((mode) => mode.targetRequired).map((mode) => mode.id));
const triggerExamples = [
  "解析这图",
  "分析参考图结构",
  "解析图片结构",
  "图转节点树",
  "转代码",
  "还原页面",
  "复刻这个页面",
  "走设计稿流程",
  "生成页面",
  "根据这个 Figma 链接实现 iOS 页面",
  "根据这个 Figma 链接实现 Android 页面",
  "根据这个 Figma 链接实现 Web 页面",
  "根据设计稿实现 UIKit 页面",
  "根据设计稿实现 Compose 页面",
  "根据设计稿实现 React 页面",
  "根据 Figma 还原 SwiftUI 页面",
  "implement this Figma in UIKit",
  "implement this Figma in Compose",
  "implement this Figma in React",
  "Figma to code",
  "解析这个 Figma 节点",
  "根据 Figma MCP 输出继续生成跨平台节点数据",
  "implement this design",
  "convert this screenshot",
  "review this implementation against the Figma",
  "continue from this Figma node"
];

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

function sanitizeAssetName(value) {
  return String(value || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "asset";
}

function isVectorLikeNodeType(type) {
  return ["VECTOR", "LINE", "ELLIPSE", "POLYGON", "STAR", "BOOLEAN_OPERATION"].includes(type);
}

function isFigmaContainerNodeType(type) {
  return ["FRAME", "GROUP", "COMPONENT", "COMPONENT_SET", "INSTANCE"].includes(String(type || ""));
}

function isSemanticAssetName(name) {
  const normalized = String(name || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  return Boolean(
    normalized.startsWith("ic-")
    || normalized.startsWith("icon-")
    || normalized.startsWith("img-")
    || normalized.startsWith("image-")
    || normalized.startsWith("logo-")
    || normalized.startsWith("avatar-")
    || normalized.startsWith("thumbnail-")
    || normalized.includes("/icon")
    || normalized.includes("/ic-")
    || normalized.includes("图标")
    || normalized.includes("切图")
  );
}

function isIconLikeSize(width, height) {
  const maxSide = Math.max(Number(width || 0), Number(height || 0));
  const minSide = Math.min(Number(width || 0), Number(height || 0));
  return maxSide > 0 && maxSide <= 128 && minSide > 0;
}

function containsVectorLikeDescendant(node) {
  for (const child of Array.isArray(node && node.children) ? node.children : []) {
    if (isVectorLikeNodeType(String(child.type || "UNKNOWN"))) return true;
    if (containsVectorLikeDescendant(child)) return true;
  }
  return false;
}

function inferAssetHints(node) {
  const fills = Array.isArray(node.fills) ? node.fills : [];
  const imageRefs = fills
    .filter((fill) => fill && fill.type === "IMAGE" && fill.imageRef)
    .map((fill) => String(fill.imageRef));
  const bbox = node.absoluteBoundingBox || node.absoluteRenderBounds || node.bbox || {};
  const width = Number(bbox.width || 0);
  const height = Number(bbox.height || 0);
  const maxSide = Math.max(width, height);
  const lowerName = String(node.name || "").toLowerCase();
  const type = String(node.type || "UNKNOWN");
  const isVectorLike = isVectorLikeNodeType(type);
  const isContainer = isFigmaContainerNodeType(type);
  const hasText = typeof node.characters === "string" && node.characters.trim().length > 0;
  const isSemanticName = isSemanticAssetName(node.name);
  const iconLikeSize = isIconLikeSize(width, height);
  const hasVectorDescendant = containsVectorLikeDescendant(node);
  const isPreferredAssetWrapper = Boolean(isContainer && isSemanticName && iconLikeSize && !hasText && (hasVectorDescendant || imageRefs.length > 0));
  const isLikelyIcon = Boolean(!hasText && iconLikeSize && (isPreferredAssetWrapper || (isVectorLike && (isSemanticName || lowerName.includes("star") || lowerName.includes("vector")))));
  const isLikelyIllustration = Boolean(isVectorLike && maxSide > 128);
  return {
    imageRefs,
    hasImageFill: imageRefs.length > 0,
    isVectorLike,
    isContainer,
    isSemanticName,
    isPreferredAssetWrapper,
    hasVectorDescendant,
    isLikelyIcon,
    isLikelyIllustration,
    shouldExport: imageRefs.length > 0 || isPreferredAssetWrapper || isLikelyIcon || isLikelyIllustration
  };
}

function collectFigmaNodes(node, parentId = null, output = [], ancestry = []) {
  if (!node || typeof node !== "object") return output;
  const id = String(node.id || node.nodeId || node.name || `node-${output.length + 1}`);
  const bbox = node.absoluteBoundingBox || node.absoluteRenderBounds || node.bbox || null;
  const children = Array.isArray(node.children) ? node.children : [];
  const name = String(node.name || id);
  const assetHints = inferAssetHints(node);
  output.push({
    id,
    parentId,
    type: String(node.type || "UNKNOWN"),
    name,
    depth: ancestry.length,
    path: [...ancestry, name].join(" / "),
    bbox: bbox
      ? {
          x: Number(bbox.x || 0),
          y: Number(bbox.y || 0),
          width: Number(bbox.width || 0),
          height: Number(bbox.height || 0)
        }
      : undefined,
    renderBounds: node.absoluteRenderBounds
      ? {
          x: Number(node.absoluteRenderBounds.x || 0),
          y: Number(node.absoluteRenderBounds.y || 0),
          width: Number(node.absoluteRenderBounds.width || 0),
          height: Number(node.absoluteRenderBounds.height || 0)
        }
      : undefined,
    visible: node.visible !== false,
    text: typeof node.characters === "string" ? node.characters : undefined,
    style: node.style || undefined,
    styles: node.styles || undefined,
    layout: {
      layoutMode: node.layoutMode,
      layoutWrap: node.layoutWrap,
      layoutSizingHorizontal: node.layoutSizingHorizontal,
      layoutSizingVertical: node.layoutSizingVertical,
      primaryAxisSizingMode: node.primaryAxisSizingMode,
      counterAxisSizingMode: node.counterAxisSizingMode,
      primaryAxisAlignItems: node.primaryAxisAlignItems,
      counterAxisAlignItems: node.counterAxisAlignItems,
      itemSpacing: node.itemSpacing,
      paddingLeft: node.paddingLeft,
      paddingRight: node.paddingRight,
      paddingTop: node.paddingTop,
      paddingBottom: node.paddingBottom,
      gridRowCount: node.gridRowCount,
      gridColumnCount: node.gridColumnCount,
      gridRowGap: node.gridRowGap,
      gridColumnGap: node.gridColumnGap
    },
    fills: Array.isArray(node.fills) ? node.fills : undefined,
    strokes: Array.isArray(node.strokes) ? node.strokes : undefined,
    effects: Array.isArray(node.effects) ? node.effects : undefined,
    exportSettings: Array.isArray(node.exportSettings) ? node.exportSettings : undefined,
    constraints: node.constraints || undefined,
    cornerRadius: node.cornerRadius,
    rectangleCornerRadii: node.rectangleCornerRadii,
    blendMode: node.blendMode,
    opacity: node.opacity,
    clipsContent: node.clipsContent,
    component: node.componentId || node.componentProperties
      ? {
          componentId: node.componentId,
          componentSetId: node.componentSetId,
          componentProperties: node.componentProperties
        }
      : undefined,
    assetHints,
    children: children.map((child) => String(child.id || child.nodeId || child.name || "unknown"))
  });
  for (const child of children) collectFigmaNodes(child, id, output, [...ancestry, name]);
  return output;
}

function inferFigmaBoundsFromNodes(nodes) {
  const nodesWithBounds = nodes.filter((node) => node.bbox && Number.isFinite(node.bbox.width) && Number.isFinite(node.bbox.height));
  if (nodesWithBounds.length === 0) return null;
  const minX = Math.min(...nodesWithBounds.map((node) => node.bbox.x));
  const minY = Math.min(...nodesWithBounds.map((node) => node.bbox.y));
  const maxX = Math.max(...nodesWithBounds.map((node) => node.bbox.x + node.bbox.width));
  const maxY = Math.max(...nodesWithBounds.map((node) => node.bbox.y + node.bbox.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function buildNodeIndex(nodes) {
  const byType = {};
  const textNodeIds = [];
  const componentInstanceIds = [];
  const assetCandidateIds = [];
  for (const node of nodes) {
    byType[node.type] = (byType[node.type] || 0) + 1;
    if (node.text) textNodeIds.push(node.id);
    if (node.component && node.component.componentId) componentInstanceIds.push(node.id);
    if (node.assetHints && node.assetHints.shouldExport) assetCandidateIds.push(node.id);
  }
  return {
    artifactType: "figma_node_index",
    generatedAt: nowIso(),
    summary: {
      totalNodes: nodes.length,
      nodeTypes: byType,
      textNodeCount: textNodeIds.length,
      componentInstanceCount: componentInstanceIds.length,
      assetCandidateCount: assetCandidateIds.length
    },
    ids: {
      textNodeIds,
      componentInstanceIds,
      assetCandidateIds
    }
  };
}

function extractFigmaRootNode(rawNode, preferredNodeId) {
  if (!rawNode || typeof rawNode !== "object") return null;
  if (rawNode.document || rawNode.node) return rawNode.document || rawNode.node;
  if (rawNode.nodes && typeof rawNode.nodes === "object") {
    const normalizedPreferred = normalizeNodeId(preferredNodeId || "");
    if (normalizedPreferred && rawNode.nodes[normalizedPreferred] && rawNode.nodes[normalizedPreferred].document) {
      return rawNode.nodes[normalizedPreferred].document;
    }
    const firstKey = Object.keys(rawNode.nodes)[0];
    if (firstKey && rawNode.nodes[firstKey] && rawNode.nodes[firstKey].document) {
      return rawNode.nodes[firstKey].document;
    }
  }
  return rawNode;
}

function inferTargetProfiles(targets) {
  const selected = Array.isArray(targets) && targets.length > 0 ? targets : ["generic"];
  return selected.map((target) => {
    if (target === "web-react" || target === "web-next") return { target, vectorFormat: "svg", rasterFormat: "png", iconScale: 1 };
    if (target === "android-compose" || target === "android-view") return { target, vectorFormat: "png", rasterFormat: "png", iconScale: 1 };
    if (target === "ios-uikit" || target === "ios-swiftui") return { target, vectorFormat: "png", rasterFormat: "png", iconScale: 3 };
    return { target, vectorFormat: "svg", rasterFormat: "png", iconScale: 1 };
  });
}

function buildNodeLookup(nodes) {
  return new Map((nodes || []).map((node) => [node.id, node]));
}

function hasExportableWrapperAncestor(node, nodeById, wrapperIds) {
  let parentId = node && node.parentId;
  while (parentId) {
    if (wrapperIds.has(parentId)) return true;
    const parent = nodeById.get(parentId);
    parentId = parent && parent.parentId;
  }
  return false;
}

function relativeBounds(childBounds, parentBounds) {
  if (!childBounds || !parentBounds) return null;
  return {
    x: childBounds.x - parentBounds.x,
    y: childBounds.y - parentBounds.y,
    width: childBounds.width,
    height: childBounds.height
  };
}

function collectRenderableDescendants(node, nodeById, output = []) {
  for (const childId of node.children || []) {
    const child = nodeById.get(childId);
    if (!child) continue;
    const hints = child.assetHints || {};
    if (hints.isVectorLike || hints.hasImageFill || child.type === "RECTANGLE" || child.type === "ELLIPSE") output.push(child);
    collectRenderableDescendants(child, nodeById, output);
  }
  return output;
}

function inferAssetLayoutContract(node, nodeById) {
  const parent = node.parentId ? nodeById.get(node.parentId) : null;
  const renderableChildren = collectRenderableDescendants(node, nodeById);
  const primaryChild = renderableChildren.find((child) => child.bbox) || null;
  const parentTextSiblings = parent
    ? (parent.children || []).map((id) => nodeById.get(id)).filter((sibling) => sibling && sibling.id !== node.id && sibling.text)
    : [];
  const insets = primaryChild && node.bbox
    ? {
        left: primaryChild.bbox.x - node.bbox.x,
        top: primaryChild.bbox.y - node.bbox.y,
        right: node.bbox.x + node.bbox.width - (primaryChild.bbox.x + primaryChild.bbox.width),
        bottom: node.bbox.y + node.bbox.height - (primaryChild.bbox.y + primaryChild.bbox.height)
      }
    : null;
  return {
    placementRule: "preserve_figma_wrapper_bbox",
    sourceBounds: node.bbox || undefined,
    renderBounds: node.renderBounds || undefined,
    innerGraphicBounds: primaryChild && primaryChild.bbox ? primaryChild.bbox : undefined,
    innerGraphicRelativeBounds: primaryChild && node.bbox ? relativeBounds(primaryChild.bbox, node.bbox) : undefined,
    contentInsets: insets || undefined,
    parentId: node.parentId || undefined,
    parentLayout: parent && parent.layout ? parent.layout : undefined,
    textSiblingIds: parentTextSiblings.map((sibling) => sibling.id),
    textSiblings: parentTextSiblings.map((sibling) => ({
      id: sibling.id,
      text: sibling.text,
      bbox: sibling.bbox,
      relativeBounds: node.bbox ? relativeBounds(sibling.bbox, node.bbox) : undefined
    }))
  };
}

function buildAssetPlan(nodes, targets, imageFillMap = {}) {
  const plan = [];
  const profiles = inferTargetProfiles(targets);
  const seen = new Set();
  const nodeById = buildNodeLookup(nodes);
  const preferredWrapperIds = new Set(nodes.filter((node) => node.assetHints && node.assetHints.isPreferredAssetWrapper).map((node) => node.id));
  for (const node of nodes) {
    const hints = node.assetHints || {};
    const safeId = node.id.replace(/[:/\\]/g, "-");
    if (hints.hasImageFill) {
      for (const imageRef of hints.imageRefs) {
        const key = `image-ref:${imageRef}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ext = "png";
        const relativePath = path.join("assets", "figma", "shared", "images", `${sanitizeAssetName(node.name)}-${safeId}.${ext}`);
        plan.push({
          id: key,
          nodeId: node.id,
          kind: "image_fill",
          sourceType: "image_ref",
          imageRef,
          relativePath,
          format: ext,
          available: Boolean(imageFillMap[imageRef]),
          target: "shared"
        });
      }
    }
    if (!hints.isLikelyIcon && !hints.isLikelyIllustration) continue;
    if (!hints.isPreferredAssetWrapper && hasExportableWrapperAncestor(node, nodeById, preferredWrapperIds)) continue;
    for (const profile of profiles) {
      const format = hints.isLikelyIcon || hints.isLikelyIllustration ? profile.vectorFormat : profile.rasterFormat;
      const ext = format === "svg" ? "svg" : format === "pdf" ? "pdf" : "png";
      const variantKey = `node:${profile.target}:${node.id}:${format}`;
      if (seen.has(variantKey)) continue;
      seen.add(variantKey);
      const folder = hints.isLikelyIcon ? "icons" : "illustrations";
      const relativePath = path.join("assets", "figma", profile.target, folder, `${sanitizeAssetName(node.name)}-${safeId}.${ext}`);
      plan.push({
        id: variantKey,
        nodeId: node.id,
        kind: hints.isLikelyIcon ? "icon" : "illustration",
        sourceType: "node_render",
        relativePath,
        format,
        scale: ext === "png" ? profile.iconScale : undefined,
        target: profile.target,
        sourceNodeName: node.name,
        sourceNodeType: node.type,
        exportPolicy: {
          selectedNodeRole: hints.isPreferredAssetWrapper ? "semantic_asset_wrapper" : "renderable_node",
          preservesWrapperBounds: Boolean(hints.isPreferredAssetWrapper),
          skipDescendantRenderableNodes: Boolean(hints.isPreferredAssetWrapper),
          reason: hints.isPreferredAssetWrapper
            ? "Named icon/image wrapper node with its own Figma bbox must be exported instead of inner vector children."
            : "No semantic wrapper ancestor was available."
        },
        layoutContract: inferAssetLayoutContract(node, nodeById),
        renderOptions: {
          contentsOnly: true,
          useAbsoluteBounds: true,
          svgIncludeId: true,
          svgIncludeNodeId: true,
          svgOutlineText: false
        }
      });
    }
  }
  return {
    artifactType: "figma_asset_plan",
    generatedAt: nowIso(),
    items: plan
  };
}

async function downloadAssetPlan({ runRoot, assetPlan, fileKey, version, apiToken, imageFillMap }) {
  const downloaded = [];
  const sharedImageRefs = new Map();
  for (const item of assetPlan.items) {
    const outputPath = resolveInside(runRoot, item.relativePath);
    if (item.sourceType === "image_ref") {
      const imageUrl = imageFillMap[item.imageRef];
      if (!imageUrl) continue;
      if (sharedImageRefs.has(item.imageRef)) {
        downloaded.push({ ...item, outputPath: sharedImageRefs.get(item.imageRef) });
        continue;
      }
      const result = await downloadToFile(imageUrl, outputPath);
      sharedImageRefs.set(item.imageRef, outputPath);
      downloaded.push({ ...item, outputPath, bytes: result.bytes });
      continue;
    }
    const response = await fetchRenderedImages({
      fileKey,
      nodeIds: [item.nodeId],
      apiToken,
      format: item.format,
      scale: item.scale,
      svgOutlineText: item.renderOptions && item.renderOptions.svgOutlineText,
      svgIncludeId: item.renderOptions && item.renderOptions.svgIncludeId,
      svgIncludeNodeId: item.renderOptions && item.renderOptions.svgIncludeNodeId,
      contentsOnly: item.renderOptions && item.renderOptions.contentsOnly,
      useAbsoluteBounds: item.renderOptions && item.renderOptions.useAbsoluteBounds,
      version
    });
    const imageUrl = response.images && response.images[normalizeNodeId(item.nodeId)];
    if (!imageUrl) continue;
    const result = await downloadToFile(imageUrl, outputPath);
    downloaded.push({ ...item, outputPath, bytes: result.bytes });
  }
  return {
    artifactType: "figma_asset_downloads",
    generatedAt: nowIso(),
    count: downloaded.length,
    items: downloaded
  };
}

async function maybeFetchFigmaRestArtifacts(runRoot, manifest, figma, args) {
  const parsed = parseFigmaUrl(figma.url || args.figmaUrl || "");
  const fileKey = sanitizeFileKey(figma.fileKey || parsed.fileKey);
  const nodeId = normalizeNodeId(figma.nodeId || parsed.nodeId);
  const apiToken = resolveApiToken(figma, args);
  const needsApiFetch = Boolean(args.fetchFromApi || figma.source === "figma_rest" || (!args.nodeJson && !args.nodeJsonPath));
  if (needsApiFetch && fileKey && nodeId && !apiToken) {
    fail([
      "Missing Figma API token for direct Figma REST ingestion.",
      "Configure one of these env vars: FIGMA_API_TOKEN, FIGMA_ACCESS_TOKEN, FIGMA_OAUTH_TOKEN.",
      "One-command Codex setup:",
      "  ui-design-to-code-mcp setup-figma-token",
      "Recommended commands:",
      "  ui-design-to-code-mcp configure-figma-token --client codex --token <YOUR_TOKEN>",
      "  ui-design-to-code-mcp configure-figma-token --client cursor --scope project --token <YOUR_TOKEN>",
      "  printf %s '<YOUR_TOKEN>' | ui-design-to-code-mcp configure-figma-token --client codex --stdin"
    ].join("\n"));
  }
  const shouldFetch = Boolean(needsApiFetch && fileKey && nodeId && apiToken);
  if (!shouldFetch) return null;

  const depth = Number.isFinite(Number(args.depth)) ? Number(args.depth) : undefined;
  const version = args.version ? String(args.version) : undefined;
  const geometry = args.geometry || "paths";
  const rawNode = await fetchFigmaJson({ fileKey, nodeId, depth, version, apiToken, geometry });
  const meta = await fetchFigmaMeta({ fileKey, apiToken });
  const imageFills = await fetchImageFillMap({ fileKey, apiToken });
  let comments = { comments: [], unavailable: false };
  try {
    comments = await fetchFigmaComments({ fileKey, apiToken });
  } catch (error) {
    comments = { comments: [], unavailable: true, error: String(error && error.message || error) };
  }

  const rawNodePath = resolveInside(runRoot, "figma/raw-node-response.json");
  const rawMetaPath = resolveInside(runRoot, "figma/raw-file-metadata.json");
  const rawImageFillPath = resolveInside(runRoot, "figma/raw-image-fills.json");
  const rawCommentsPath = resolveInside(runRoot, "figma/raw-comments.json");
  writeHelperJson(rawNodePath, rawNode);
  writeHelperJson(rawMetaPath, meta);
  writeHelperJson(rawImageFillPath, imageFills);
  writeHelperJson(rawCommentsPath, comments);

  let screenshotPath = args.screenshotPath ? path.resolve(String(args.screenshotPath)) : (figma.screenshotPath ? path.resolve(String(figma.screenshotPath)) : "");
  if (!screenshotPath && args.downloadScreenshot !== false) {
    const render = await fetchRenderedImages({
      fileKey,
      nodeIds: [nodeId],
      apiToken,
      format: "png",
      scale: Number(args.screenshotScale || 2),
      contentsOnly: false,
      useAbsoluteBounds: true,
      version
    });
    const renderUrl = render.images && render.images[nodeId];
    if (renderUrl) {
      screenshotPath = resolveInside(runRoot, "figma/figma-screenshot.png");
      await downloadToFile(renderUrl, screenshotPath);
    }
  }

  const fetchedFigma = {
    ...figma,
    url: figma.url || parsed.url,
    fileKey,
    nodeId,
    source: "figma_rest",
    screenshotPath
  };

  const assetPlan = buildAssetPlan(
    collectFigmaNodes(extractFigmaRootNode(rawNode, nodeId)),
    manifest.run && manifest.run.targets,
    imageFills.images || {}
  );
  const assetPlanPath = resolveInside(runRoot, "figma/figma-asset-plan.json");
  writeHelperJson(assetPlanPath, assetPlan);

  let downloads = null;
  if (args.downloadAssets !== false) {
    downloads = await downloadAssetPlan({
      runRoot,
      assetPlan,
      fileKey,
      version,
      apiToken,
      imageFillMap: imageFills.images || {}
    });
    writeHelperJson(resolveInside(runRoot, "figma/figma-asset-downloads.json"), downloads);
    if (args.projectRoot) {
      const syncResult = runScript("sync_target_assets.js", [
        "--run", runRoot,
        "--downloads", resolveInside(runRoot, "figma/figma-asset-downloads.json"),
        "--project-root", path.resolve(String(args.projectRoot)),
        "--targets", ((manifest.run && manifest.run.targets) || []).join(",")
      ]);
      if (syncResult.exitCode !== 0) fail(syncResult.stderr || syncResult.stdout || "sync_target_assets failed during Figma ingestion");
      writeHelperJson(resolveInside(runRoot, "targets/asset-sync-manifest.json"), JSON.parse(syncResult.stdout));
    }
  }

  return {
    rawNode,
    figma: fetchedFigma,
    screenshotPath,
    imageFills,
    assetPlanPath: "figma/figma-asset-plan.json",
    assetDownloadsPath: downloads ? "figma/figma-asset-downloads.json" : "",
    assetSyncManifestPath: downloads && args.projectRoot ? "targets/asset-sync-manifest.json" : "",
    rawNodePath: "figma/raw-node-response.json",
    rawMetaPath: "figma/raw-file-metadata.json",
    rawImageFillPath: "figma/raw-image-fills.json",
    rawCommentsPath: "figma/raw-comments.json",
    comments
  };
}

function output(content) {
  return {
    content: [{ type: "text", text: typeof content === "string" ? content : JSON.stringify(content, null, 2) }]
  };
}

function isDesignNoteNode(node) {
  if (!node || !node.text) return false;
  const haystack = [node.name, node.path, node.text].filter(Boolean).join(" ").toLowerCase();
  return /annotation|annotate|callout|comment|note|spec|label|说明|标注|注释|备注|连线|需求|规则|提示/.test(haystack);
}

function normalizeFigmaComments(rawComments = {}) {
  const comments = Array.isArray(rawComments.comments) ? rawComments.comments : [];
  return comments.map((comment) => ({
    id: comment.id,
    message: comment.message,
    clientMeta: comment.client_meta,
    fileKey: comment.file_key,
    parentId: comment.parent_id,
    user: comment.user ? { id: comment.user.id, handle: comment.user.handle } : undefined,
    createdAt: comment.created_at,
    resolvedAt: comment.resolved_at,
    orderId: comment.order_id
  }));
}

function buildDesignNotes(nodes, rawComments = {}) {
  const nodeNotes = (nodes || []).filter(isDesignNoteNode).map((node) => ({
    id: node.id,
    name: node.name,
    text: node.text,
    bbox: node.bbox,
    path: node.path,
    source: "figma_text_annotation_candidate",
    confidence: /说明|标注|注释|annotation|callout|comment|note|spec|需求|规则/.test([node.name, node.path].join(" ").toLowerCase()) ? 0.85 : 0.55
  }));
  const comments = normalizeFigmaComments(rawComments);
  return {
    artifactType: "figma_design_notes",
    generatedAt: nowIso(),
    nodeAnnotationCandidates: nodeNotes,
    comments,
    commentsUnavailable: Boolean(rawComments && rawComments.unavailable),
    commentsError: rawComments && rawComments.error,
    implementationRule: "Generated code and target IR must read these notes before implementation. Treat callout/annotation text and Figma comments as design requirements unless they conflict with explicit user instructions."
  };
}

function hasFigmaSourceSignal(args = {}) {
  const text = String(args.requestText || args.sourceSummary || "").toLowerCase();
  const figma = args.figma || {};
  return Boolean(
    args.figmaUrl
    || figma.url
    || figma.fileKey
    || figma.nodeId
    || args.nodeJson
    || args.nodeJsonPath
    || text.includes("figma")
    || text.includes("node-id")
    || text.includes("figma.com")
    || text.includes("设计稿")
  );
}

function figmaTokenStatus(args = {}) {
  const info = resolveApiTokenInfo(args.figma || {}, args);
  const configured = Boolean(info.token);
  return {
    status: configured ? "configured" : "missing",
    configured,
    source: info.source || "",
    requiredFor: "Figma REST ingestion, screenshot export, image fill download, and target-aware Figma asset sync.",
    userPrompt: "请直接输入 Figma token。收到后我会自动写入全局 Codex 配置，不会在回复中回显 token。",
    mcpConfigureTool: "configure_figma_token",
    fallbackCommand: "ui-design-to-code-mcp setup-figma-token",
    stdinCommand: "printf %s '<YOUR_FIGMA_TOKEN>' | ui-design-to-code-mcp configure-figma-token --client codex --stdin",
    configPath: "~/.codex/config.toml [mcp_servers.ui_design_to_code.env].FIGMA_API_TOKEN"
  };
}

function checkFigmaToken(args = {}) {
  const status = figmaTokenStatus(args);
  return output({
    status: status.configured ? "figma_token_configured" : "figma_token_required",
    figmaToken: status,
    nextStep: status.configured
      ? "Call get_run_modes and show/confirm the execution mode before create_design_run."
      : "Ask the user to input the Figma token, call configure_figma_token with that token, then call check_figma_token again before get_run_modes.",
    message: status.configured
      ? `Figma token is available from ${status.source}.`
      : [
          "Figma token is required before running Figma design ingestion.",
          status.userPrompt,
          `Auto-configure with MCP tool: ${status.mcpConfigureTool}`,
          `Fallback command if interactive tool use is unavailable: ${status.fallbackCommand}`,
          `Script-friendly fallback: ${status.stdinCommand}`
        ].join("\n")
  });
}

function setCodexTomlEnv(filePath, envVar, token) {
  let text = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const envSectionPattern = /\n?\[mcp_servers\.ui_design_to_code\.env\]\n(?:[^\n]*\n)*?(?=\n\[|$)/m;
  const envLine = `${envVar} = ${JSON.stringify(token)}\n`;
  if (envSectionPattern.test(text)) {
    let block = text.match(envSectionPattern)[0];
    const linePattern = new RegExp(`^${envVar}\\s*=.*$`, "m");
    block = linePattern.test(block) ? block.replace(linePattern, envLine.trimEnd()) : `${block}${envLine}`;
    text = text.replace(envSectionPattern, block);
  } else {
    text = `${text.trimEnd()}\n\n[mcp_servers.ui_design_to_code.env]\n${envLine}`;
  }
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, `${text.trimEnd()}\n`);
}

function configureFigmaToken(args = {}) {
  const token = String(args.token || "").trim();
  const envVar = String(args.envVar || "FIGMA_API_TOKEN").trim();
  if (!token) fail("token is required. Ask the user to input the Figma token, then call configure_figma_token with { token }.");
  if (!/^[A-Z][A-Z0-9_]*$/.test(envVar)) fail(`invalid envVar: ${envVar}`);
  const filePath = path.join(os.homedir(), ".codex", "config.toml");
  setCodexTomlEnv(filePath, envVar, token);
  const status = figmaTokenStatus({ tokenEnvVar: envVar });
  return output({
    status: "figma_token_configured",
    envVar,
    configPath: `${filePath} [mcp_servers.ui_design_to_code.env].${envVar}`,
    tokenLength: token.length,
    tokenEchoed: false,
    nextStep: "Call check_figma_token, then get_run_modes to show/confirm execution mode before create_design_run.",
    figmaToken: {
      status: status.status,
      configured: status.configured,
      source: status.source,
      configPath: status.configPath
    }
  });
}

function getRunModes(args = {}) {
  const prompt = [
    "请选择执行模式：",
    "1. decode-only：只解析设计源和节点树，不生成平台计划或代码。",
    "2. plan-only：生成跨平台节点数据和转换计划，不生成布局 IR 或代码。",
    "3. target-ir：生成目标平台布局 IR，不写代码。",
    "4. codegen：在目标平台生成/修改代码，做常规项目验证和清理；不强制截图验收。",
    "5. codegen-with-auto-review：先生成/修改代码，再自动启动浏览器/模拟器/仿真器截图对比；非素材 UI 还原度必须 >= 90% 才可交付。",
    "6. runtime-review：启动已有实现，在浏览器/模拟器/仿真器中截图并和原图对比，不改代码。"
  ].join("\n");
  const requestText = String(args.requestText || "");
  const explicitMode = [...runModes]
    .sort((a, b) => b.id.length - a.id.length)
    .find((mode) => requestText.includes(mode.id));
  const lowerRequestText = requestText.toLowerCase();
  const recommendedMode = explicitMode ? explicitMode.id : inferRunModeFromRequest(lowerRequestText);
  const figmaSourcePresent = hasFigmaSourceSignal(args);
  const tokenStatus = figmaSourcePresent ? figmaTokenStatus(args) : null;
  if (figmaSourcePresent && !tokenStatus.configured) {
    return output({
      status: "figma_token_required",
      figmaToken: tokenStatus,
      userSelectionRequired: false,
      modes: runModes,
      targetPlatforms: ["ios-uikit", "ios-swiftui", "web-react", "web-next", "android-compose", "android-view"],
      prompt: [
        "检测到 Figma 设计稿输入，但 ui_design_to_code MCP 当前没有可用的 Figma token。",
        tokenStatus.userPrompt,
        `收到 token 后调用 MCP 工具 ${tokenStatus.mcpConfigureTool} 自动写入配置。`,
        `如果无法交互式输入，再使用备用命令：${tokenStatus.fallbackCommand}`,
        "配置完成后，再调用 get_run_modes 展示执行模式选择。"
      ].join("\n"),
      rule: "For Figma design flows, check Figma token first. Do not call create_design_run or ingest_figma_source until the token is configured, unless the caller provides nodeJson/nodeJsonPath and explicitly disables REST fetch."
    });
  }
  return output({
    status: explicitMode ? "mode_explicit" : "mode_selection_required",
    explicitMode: explicitMode && explicitMode.id,
    recommendedMode,
    figmaToken: tokenStatus,
    userSelectionRequired: !explicitMode,
    modes: runModes,
    targetPlatforms: ["ios-uikit", "ios-swiftui", "web-react", "web-next", "android-compose", "android-view"],
    triggerExamples,
    prompt,
    autoTriggerRule: "When a UI screenshot, preview image, Figma MCP node dataset, Figma screenshot, or hybrid source is present and the user asks for decoding, implementation, restoration, parity review, or target-platform UI generation, discover this MCP and call get_run_modes before local-only implementation work.",
    rule: "If the user did not explicitly choose a mode, show the mode-selection prompt to the user before create_design_run. recommendedMode may be used as the default highlighted option, but it is not user consent. Do not create a run for MCP existence, version, doctor, install, or routing checks unless a design source and decode/implementation/review intent are also present."
  });
}

function inferRunModeFromRequest(lowerRequestText) {
  if (!lowerRequestText) return null;
  const hasRuntimeReviewIntent = [
    "runtime-review",
    "runtime review",
    "只验收",
    "只对比",
    "截图对比",
    "视觉对比",
    "运行时",
    "已有实现",
    "existing implementation"
  ].some((keyword) => lowerRequestText.includes(keyword));
  const hasAutoReviewIntent = [
    "codegen-with-auto-review",
    "auto review",
    "1:1",
    "一比一",
    "截图验收",
    "parity",
    "visual review",
    "screenshot acceptance",
    "simulator",
    "emulator",
    "browser review",
    "还原度"
  ].some((keyword) => lowerRequestText.includes(keyword));
  const hasCodegenIntent = [
    "codegen",
    "implement",
    "implementation",
    "convert to code",
    "to code",
    "转代码",
    "生成代码",
    "实现",
    "还原页面",
    "复刻",
    "生成页面",
    "修改代码"
  ].some((keyword) => lowerRequestText.includes(keyword));
  const hasTargetIrIntent = [
    "target-ir",
    "target ir",
    "layout ir",
    "布局 ir",
    "实现规格",
    "handoff",
    "交付规格"
  ].some((keyword) => lowerRequestText.includes(keyword));
  const hasPlanIntent = [
    "plan-only",
    "plan only",
    "转换计划",
    "平台计划",
    "跨平台",
    "adapter",
    "feasibility",
    "可行性"
  ].some((keyword) => lowerRequestText.includes(keyword));
  const hasDecodeIntent = [
    "decode",
    "decode-only",
    "解析",
    "分析结构",
    "节点树",
    "node tree",
    "semantic",
    "vision ir",
    "设计审计"
  ].some((keyword) => lowerRequestText.includes(keyword));

  if (hasRuntimeReviewIntent && !hasCodegenIntent) return "runtime-review";
  if (hasAutoReviewIntent && hasCodegenIntent) return "codegen-with-auto-review";
  if (hasCodegenIntent) return hasAutoReviewIntent ? "codegen-with-auto-review" : "codegen";
  if (hasTargetIrIntent) return "target-ir";
  if (hasPlanIntent) return "plan-only";
  if (hasDecodeIntent) return "decode-only";
  if (hasAutoReviewIntent) return "runtime-review";
  return null;
}

function createDesignRun(args) {
  const workspace = path.resolve(String(args.workspace || process.cwd()));
  if (!args.mode) fail("mode is required. Call get_run_modes and ask the user to choose before create_design_run.");
  const mode = String(args.mode);
  if (!runModeIds.has(mode)) fail(`invalid mode: ${mode}`);
  const targets = Array.isArray(args.targets) ? args.targets : [];
  if (targetRequiredModes.has(mode) && targets.length === 0) {
    fail(`targets are required for mode: ${mode}`);
  }
  const slug = slugify(args.slug || args.sourceName || "design");
  const root = args.useTmp
    ? path.join("/private/tmp/ui-design-to-code", `${timestamp()}-${slug}`)
    : path.join(workspace, "generated", "ui-design-to-code", `${timestamp()}-${slug}`);
  mkdirp(root);
  for (const dir of ["source", "figma", "analysis", "vision", "compression", "semantic", "cross-platform", "targets", "review", "assets", "qa"]) {
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
      targets
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

async function ingestFigmaSource(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const { manifestPath, manifest } = loadManifest(runRoot);
  const sourceId = String(args.sourceId || "figma-source");
  let figma = args.figma || {};
  const fetched = await maybeFetchFigmaRestArtifacts(runRoot, manifest, figma, args);
  if (fetched) figma = fetched.figma;
  let rawNode = args.nodeJson || null;
  if (fetched && fetched.rawNode) rawNode = fetched.rawNode;
  if (!rawNode && args.nodeJsonPath) rawNode = readJson(path.resolve(String(args.nodeJsonPath)));
  const figmaRootNode = rawNode ? extractFigmaRootNode(rawNode, figma.nodeId) : null;
  const nodes = figmaRootNode ? collectFigmaNodes(figmaRootNode) : [];
  const screenshotPath = fetched && fetched.screenshotPath
    ? fetched.screenshotPath
    : (args.screenshotPath ? path.resolve(String(args.screenshotPath)) : figma.screenshotPath);
  const imageSize = screenshotPath && fs.existsSync(screenshotPath) ? inferImageSize(screenshotPath) : null;
  const sourceKind = rawNode && screenshotPath ? "hybrid" : rawNode ? "figma" : "image";
  const figmaBounds = args.figmaBounds || inferFigmaBoundsFromNodes(nodes);
  const designSourcePath = "source/design-source-manifest.json";
  const datasetPath = "figma/figma-source-dataset.json";
  const nodeIndexPath = "figma/figma-node-index.json";
  const designNotesPath = "figma/figma-design-notes.json";
  const imageManifestPath = "source/page.source-manifest.json";

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
        url: figma.url,
        nodeJsonPath: args.nodeJsonPath ? path.resolve(String(args.nodeJsonPath)) : undefined,
        rawNodeResponsePath: fetched ? path.join(runRoot, fetched.rawNodePath) : undefined,
        rawFileMetadataPath: fetched ? path.join(runRoot, fetched.rawMetaPath) : undefined,
        rawImageFillPath: fetched ? path.join(runRoot, fetched.rawImageFillPath) : undefined,
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
      screenshotPath,
      url: figma.url
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
    assetPlanPath: fetched && fetched.assetPlanPath ? path.join(runRoot, fetched.assetPlanPath) : undefined,
    uncertainties: args.uncertainties || []
  };

  const nodeIndex = buildNodeIndex(nodes);
  const designNotes = buildDesignNotes(nodes, fetched && fetched.comments ? fetched.comments : {});

  const imageManifest = imageSize && screenshotPath
    ? {
        source: {
          id: sourceId,
          path: screenshotPath,
          widthPx: imageSize.widthPx,
          heightPx: imageSize.heightPx,
          colorSpace: "unknown",
          pixelDensity: {
            scale: Number(args.screenshotScale || 2),
            unit: "png_export_scale",
            confidence: 0.7
          }
        },
        coordinateSpaces: {
          sourcePixel: { origin: "top_left", unit: "px", bounds: { x: 0, y: 0, width: imageSize.widthPx, height: imageSize.heightPx } },
          normalized: { origin: "top_left", range: "0_to_1" },
          logical: { unit: "unknown", scaleFromSourcePx: 0, confidence: 0 }
        },
        knownViewport: {},
        uncertainties: []
      }
    : null;

  writeJson(resolveInside(runRoot, designSourcePath), designSource);
  writeJson(resolveInside(runRoot, datasetPath), dataset);
  writeJson(resolveInside(runRoot, nodeIndexPath), nodeIndex);
  writeJson(resolveInside(runRoot, designNotesPath), designNotes);
  if (imageManifest) writeJson(resolveInside(runRoot, imageManifestPath), imageManifest);
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
  upsertArtifact(manifest, {
    id: "figma-node-index",
    path: nodeIndexPath,
    category: "source",
    artifactType: "figma_node_index",
    cleanupStatus: "keep"
  });
  upsertArtifact(manifest, {
    id: "figma-design-notes",
    path: designNotesPath,
    category: "source",
    artifactType: "figma_design_notes",
    cleanupStatus: "keep"
  });
  if (imageManifest) {
    upsertArtifact(manifest, {
      id: "source-image-manifest",
      path: imageManifestPath,
      category: "source",
      artifactType: "source_image_manifest",
      cleanupStatus: "keep"
    });
  }
  if (fetched) {
    upsertArtifact(manifest, {
      id: "figma-raw-node-response",
      path: fetched.rawNodePath,
      category: "source",
      artifactType: "figma_raw_node_response",
      cleanupStatus: "keep"
    });
    upsertArtifact(manifest, {
      id: "figma-raw-file-metadata",
      path: fetched.rawMetaPath,
      category: "source",
      artifactType: "figma_raw_file_metadata",
      cleanupStatus: "keep"
    });
    upsertArtifact(manifest, {
      id: "figma-raw-image-fills",
      path: fetched.rawImageFillPath,
      category: "source",
      artifactType: "figma_raw_image_fills",
      cleanupStatus: "keep"
    });
    upsertArtifact(manifest, {
      id: "figma-raw-comments",
      path: fetched.rawCommentsPath,
      category: "source",
      artifactType: "figma_raw_comments",
      cleanupStatus: "keep"
    });
    upsertArtifact(manifest, {
      id: "figma-asset-plan",
      path: fetched.assetPlanPath,
      category: "assets",
      artifactType: "figma_asset_plan",
      cleanupStatus: "keep"
    });
    if (fetched.assetDownloadsPath) {
      upsertArtifact(manifest, {
        id: "figma-asset-downloads",
        path: fetched.assetDownloadsPath,
        category: "assets",
        artifactType: "figma_asset_downloads",
        cleanupStatus: "keep"
      });
    }
    if (fetched.assetSyncManifestPath) {
      upsertArtifact(manifest, {
        id: "target-asset-sync-manifest",
        path: fetched.assetSyncManifestPath,
        category: "final",
        artifactType: "target_asset_sync_manifest",
        cleanupStatus: "keep"
      });
    }
  }
  writeJson(manifestPath, manifest);
  return output({
    designSourcePath: path.join(runRoot, designSourcePath),
    figmaDatasetPath: path.join(runRoot, datasetPath),
    nodeIndexPath: path.join(runRoot, nodeIndexPath),
    designNotesPath: path.join(runRoot, designNotesPath),
    designNoteCount: designNotes.nodeAnnotationCandidates.length,
    commentCount: designNotes.comments.length,
    assetPlanPath: fetched && fetched.assetPlanPath ? path.join(runRoot, fetched.assetPlanPath) : undefined,
    nodeCount: nodes.length,
    sourceKind
  });
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

function syncTargetAssets(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const { manifestPath, manifest } = loadManifest(runRoot);
  const downloadsPath = path.resolve(String(args.downloadsPath || ""));
  const projectRoot = path.resolve(String(args.projectRoot || ""));
  if (!fs.existsSync(downloadsPath)) fail(`downloadsPath does not exist: ${downloadsPath}`);
  if (!fs.existsSync(projectRoot)) fail(`projectRoot does not exist: ${projectRoot}`);

  const scriptArgs = ["--run", runRoot, "--downloads", downloadsPath, "--project-root", projectRoot];
  const targets = Array.isArray(args.targets) ? args.targets : (manifest.run && manifest.run.targets) || [];
  if (targets.length > 0) scriptArgs.push("--targets", targets.join(","));
  if (args.out) scriptArgs.push("--out", String(args.out));

  const result = runScript("sync_target_assets.js", scriptArgs);
  if (result.exitCode !== 0) fail(result.stderr || result.stdout || "sync_target_assets failed");
  const payload = JSON.parse(result.stdout);
  upsertArtifact(manifest, {
    id: "target-asset-sync-manifest",
    path: path.relative(runRoot, payload.outPath),
    category: "final",
    artifactType: "target_asset_sync_manifest",
    cleanupStatus: "keep"
  });
  writeJson(manifestPath, manifest);
  return output({
    status: "synced",
    outPath: payload.outPath,
    count: payload.count,
    items: payload.items
  });
}

function sliceImageAssets(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const { manifestPath, manifest } = loadManifest(runRoot);
  const sourcePath = path.resolve(String(args.sourcePath || ""));
  const layersPath = path.resolve(String(args.layersManifestPath || ""));
  if (!fs.existsSync(sourcePath)) fail(`sourcePath does not exist: ${sourcePath}`);
  if (!fs.existsSync(layersPath)) fail(`layersManifestPath does not exist: ${layersPath}`);

  const scriptArgs = [
    "--run", runRoot,
    "--source", sourcePath,
    "--layers", layersPath
  ];
  if (args.canvasWidth) scriptArgs.push("--canvas-width", String(args.canvasWidth));
  if (args.onlyType) scriptArgs.push("--only-type", String(args.onlyType));
  if (args.assetsDir) scriptArgs.push("--assets-dir", String(args.assetsDir));
  if (args.qaDir) scriptArgs.push("--qa-dir", String(args.qaDir));
  if (args.manifestOut) scriptArgs.push("--manifest-out", String(args.manifestOut));
  if (args.auditOut) scriptArgs.push("--audit-out", String(args.auditOut));
  if (args.previewOut) scriptArgs.push("--preview-out", String(args.previewOut));

  const result = runScript("slice_assets.js", scriptArgs);
  if (result.exitCode !== 0) fail(result.stderr || result.stdout || "slice_assets failed");
  const payload = JSON.parse(result.stdout);
  const artifacts = [
    {
      id: "sliced-assets-manifest",
      path: path.relative(runRoot, payload.normalizedManifestPath),
      category: "final",
      artifactType: "sliced_asset_layers_manifest",
      cleanupStatus: "keep"
    },
    {
      id: "sliced-assets-dir",
      path: path.relative(runRoot, payload.assetsDir),
      category: "final",
      artifactType: "sliced_assets_directory",
      cleanupStatus: "keep"
    },
    {
      id: "sliced-assets-bbox-preview",
      path: path.relative(runRoot, payload.bboxPreviewPath),
      category: "review",
      artifactType: "bbox_preview_svg",
      cleanupStatus: "keep"
    },
    {
      id: "sliced-assets-audit",
      path: path.relative(runRoot, payload.auditPath),
      category: "review",
      artifactType: "png_asset_audit",
      cleanupStatus: "keep"
    }
  ];
  for (const artifact of artifacts) upsertArtifact(manifest, artifact);
  writeJson(manifestPath, manifest);
  return output({
    status: "sliced",
    runRoot,
    assetsDir: payload.assetsDir,
    normalizedManifestPath: payload.normalizedManifestPath,
    bboxPreviewPath: payload.bboxPreviewPath,
    auditPath: payload.auditPath,
    slicedAssets: payload.slicedAssets,
    rule: "All slice outputs are written inside runRoot. Use assetsDir for PNG files and auditPath/bboxPreviewPath for QA evidence."
  });
}

function validatePipeline(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const result = runScript("validate_pipeline.js", ["--run", runRoot]);
  if (result.exitCode !== 0) fail(result.stderr || result.stdout || "validate_pipeline failed");
  return output(result);
}

function auditImageDecoding(args) {
  const runRoot = resolveRunRoot(args.runRoot);
  const auditOut = args.auditOut || "qa/image-decoding-audit.json";
  const scriptArgs = ["--run", runRoot, "--out", auditOut];
  if (args.sourcePath) scriptArgs.push("--source", String(args.sourcePath));
  if (args.referenceAnalysisPath) scriptArgs.push("--reference-analysis", String(args.referenceAnalysisPath));
  if (args.visionPath) scriptArgs.push("--vision", String(args.visionPath));
  if (args.compressionPath) scriptArgs.push("--compression", String(args.compressionPath));
  if (args.semanticPath) scriptArgs.push("--semantic", String(args.semanticPath));

  const result = runScript("audit_image_decoding.js", scriptArgs);
  if (result.exitCode !== 0) fail(result.stderr || result.stdout || "audit_image_decoding failed");
  const { manifestPath, manifest } = loadManifest(runRoot);
  upsertArtifact(manifest, {
    id: "image-decoding-audit",
    path: auditOut,
    category: "review",
    artifactType: "image_decoding_audit",
    cleanupStatus: "keep"
  });
  writeJson(manifestPath, manifest);
  return output(JSON.parse(result.stdout));
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

function buildReferenceAnalysis(args) {
  return registerArtifact(args, {
    id: "reference-analysis",
    artifactType: "reference_analysis",
    category: "intermediate",
    cleanupStatus: "keep",
    schemaPath: "references/reference-analysis.schema.json",
    referencePath: "references/design-image-decoding-workflow.md",
    missingMessage: "Analyze the reference image first, produce Reference Image Analysis, then call build_reference_analysis with artifactPath to register it."
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
  check_figma_token: {
    description: "Check whether ui_design_to_code has a usable Figma token before any Figma design flow. Use this first when the source is a Figma URL/node-id, Figma MCP node JSON, Figma screenshot/export, or Figma design draft. If missing, ask the user to input the token and then call configure_figma_token before get_run_modes or create_design_run.",
    inputSchema: {
      type: "object",
      properties: {
        requestText: { type: "string" },
        figma: { type: "object" },
        figmaUrl: { type: "string" },
        apiToken: { type: "string" },
        tokenEnvVar: { type: "string" }
      }
    },
    handler: checkFigmaToken
  },
  configure_figma_token: {
    description: "Write a user-provided Figma token into the global Codex ui_design_to_code MCP env config. Use only after the user directly provides the token. Never echo the token back to the user.",
    inputSchema: {
      type: "object",
      required: ["token"],
      properties: {
        token: { type: "string" },
        envVar: { type: "string" }
      }
    },
    handler: configureFigmaToken
  },
  get_run_modes: {
    description: "Return the required ui-design-to-code execution mode options and trigger examples. Use this when a design source such as Figma, screenshot, mockup, or design image is present and the user asks for decoding, implementation, restoration, parity review, or target-platform UI generation without explicitly choosing a mode before create_design_run.",
    inputSchema: {
      type: "object",
      properties: {
        requestText: { type: "string" }
      }
    },
    handler: getRunModes
  },
  create_design_run: {
    description: "Create a ui-design-to-code run directory and artifact manifest after the run mode is explicit in the user request or selected by the user from get_run_modes.",
    inputSchema: {
      type: "object",
      required: ["mode"],
      properties: {
        workspace: { type: "string" },
        slug: { type: "string" },
        mode: { type: "string", enum: runModes.map((mode) => mode.id) },
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
    description: "Ingest Figma source into shared artifacts. Supports direct Figma REST fetch via token, Figma URL-derived node fetch, provided node JSON, optional screenshot export, wrapper-aware icon/image asset downloads, Figma comments, and annotation/callout design notes while preserving the existing downstream pipeline.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: {
        runRoot: { type: "string" },
        sourceId: { type: "string" },
        figma: { type: "object" },
        figmaUrl: { type: "string" },
        nodeJson: { type: "object" },
        nodeJsonPath: { type: "string" },
        screenshotPath: { type: "string" },
        figmaBounds: { type: "object" },
        fetchFromApi: { type: "boolean" },
        apiToken: { type: "string" },
        tokenEnvVar: { type: "string" },
        depth: { type: "number" },
        version: { type: "string" },
        geometry: { type: "string" },
        downloadScreenshot: { type: "boolean" },
        screenshotScale: { type: "number" },
        downloadAssets: { type: "boolean" },
        projectRoot: { type: "string" }
      }
    },
    handler: ingestFigmaSource
  },
  sync_target_assets: {
    description: "Sync downloaded Figma assets from a run directory into target project resource locations for iOS, Android, or Web while preserving runRoot artifacts.",
    inputSchema: {
      type: "object",
      required: ["runRoot", "downloadsPath", "projectRoot"],
      properties: {
        runRoot: { type: "string" },
        downloadsPath: { type: "string" },
        projectRoot: { type: "string" },
        targets: { type: "array", items: { type: "string" } },
        out: { type: "string" }
      }
    },
    handler: syncTargetAssets
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
  audit_image_decoding: {
    description: "Audit image-decoding artifacts for reference pre-analysis, text overflow risks, media accounting, navigation structure, semantic traceability, and node-tree quality gates.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: {
        runRoot: { type: "string" },
        sourcePath: { type: "string" },
        referenceAnalysisPath: { type: "string" },
        visionPath: { type: "string" },
        compressionPath: { type: "string" },
        semanticPath: { type: "string" },
        auditOut: { type: "string", default: "qa/image-decoding-audit.json" }
      }
    },
    handler: auditImageDecoding
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
  slice_image_assets: {
    description: "Precisely crop bitmap/icon assets from a source image using a layers manifest with source_bbox entries. Outputs PNGs to runRoot/assets/slices by default, plus bbox preview and audit files with explicit paths.",
    inputSchema: {
      type: "object",
      required: ["runRoot", "sourcePath", "layersManifestPath"],
      properties: {
        runRoot: { type: "string" },
        sourcePath: { type: "string" },
        layersManifestPath: { type: "string" },
        canvasWidth: { type: "number", default: 750 },
        onlyType: { type: "string", default: "bitmap" },
        assetsDir: { type: "string", default: "assets/slices" },
        qaDir: { type: "string", default: "qa" },
        manifestOut: { type: "string", default: "assets/slices/layers.manifest.normalized.json" },
        auditOut: { type: "string", default: "qa/png-asset-audit.json" },
        previewOut: { type: "string", default: "qa/bbox-preview.svg" }
      }
    },
    handler: sliceImageAssets
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
  build_reference_analysis: {
    description: "Register model-generated Reference Image Analysis, or return the required schema for pre-decode image structure, media, text, navigation, and pixel-parity planning.",
    inputSchema: {
      type: "object",
      required: ["runRoot"],
      properties: { runRoot: { type: "string" }, artifactPath: { type: "string" }, artifactId: { type: "string" } }
    },
    handler: buildReferenceAnalysis
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

async function handleRequest(request) {
  if (request.method === "initialize") {
    return {
      protocolVersion: request.params && request.params.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "ui-design-to-code", version: packageInfo.version }
    };
  }
  if (request.method === "tools/list") return { tools: toolList() };
  if (request.method === "tools/call") {
    const name = request.params && request.params.name;
    const tool = tools[name];
    if (!tool) fail(`unknown tool: ${name}`);
    return await tool.handler((request.params && request.params.arguments) || {});
  }
  return {};
}

function writeResponse(response, framing = "line") {
  const payload = JSON.stringify(response);
  if (framing === "content-length") {
    process.stdout.write(`Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`);
    return;
  }
  process.stdout.write(`${payload}\n`);
}

async function processRequestPayload(payload, framing) {
  let response;
  let requestId = null;
  try {
    const request = JSON.parse(payload);
    requestId = request.id;
    if (!request.id && request.method && request.method.startsWith("notifications/")) return;
    response = {
      jsonrpc: "2.0",
      id: request.id,
      result: await handleRequest(request)
    };
  } catch (error) {
    response = {
      jsonrpc: "2.0",
      id: requestId,
      error: { code: -32000, message: error.message }
    };
  }
  writeResponse(response, framing);
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
      void processRequestPayload(payload, "content-length");
      continue;
    }

    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex < 0) return;
    const line = buffer.slice(0, newlineIndex).toString("utf8").trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line) void processRequestPayload(line, "line");
  }
});

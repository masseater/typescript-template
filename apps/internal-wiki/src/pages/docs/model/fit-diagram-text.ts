const INSET = 4;

const anchorOf = (text: SVGTextContentElement): number => {
  const x = Number(text.getAttribute("x") ?? text.closest("text")?.getAttribute("x"));
  if (!Number.isFinite(x)) {
    throw new Error(`the diagram text "${text.textContent}" has no x to anchor on`);
  }
  return x;
};

const roomFor = (text: SVGTextContentElement, box: DOMRect): number => {
  const anchor = getComputedStyle(text).textAnchor;
  const left = box.x + INSET;
  const right = box.x + box.width - INSET;
  const anchorX = anchorOf(text);
  if (anchor === "end") {
    return anchorX - left;
  }
  if (anchor === "middle") {
    return 2 * Math.min(anchorX - left, right - anchorX);
  }
  return right - anchorX;
};

const squeeze = (text: SVGTextContentElement, box: DOMRect): void => {
  const room = roomFor(text, box);
  if (text.getComputedTextLength() > room) {
    text.setAttribute("textLength", String(room));
    text.setAttribute("lengthAdjust", "spacingAndGlyphs");
  }
};

const frameOf = (group: Element): DOMRect => {
  const outline = group.querySelector(":scope > rect, :scope > polygon, :scope > circle");
  if (!(outline instanceof SVGGraphicsElement)) {
    throw new Error("a diagram shape has no outline to fit its text in");
  }
  return outline.getBBox();
};

const fitShapeText = (group: Element): void => {
  const box = frameOf(group);
  for (const text of group.querySelectorAll("text > tspan, text:not(:has(tspan))")) {
    if (text instanceof SVGTextContentElement) {
      squeeze(text, box);
    }
  }
};

const fitFrameLabel = (frame: Element): void => {
  const label = frame.nextElementSibling;
  if (!(frame instanceof SVGGraphicsElement && label instanceof SVGTextElement)) {
    return;
  }
  for (const line of label.querySelectorAll("tspan")) {
    squeeze(line, frame.getBBox());
  }
};

const fitDiagramText = (svg: SVGSVGElement): void => {
  for (const group of svg.querySelectorAll(
    ":scope > g.node, :scope > g.entity, :scope > g.edge-label",
  )) {
    fitShapeText(group);
  }
  for (const frame of svg.querySelectorAll(":scope > rect[rx='2']")) {
    fitFrameLabel(frame);
  }
};

export { fitDiagramText };

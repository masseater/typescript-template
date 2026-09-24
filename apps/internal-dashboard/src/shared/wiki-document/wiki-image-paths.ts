const editorImagePrefix = "/api/wiki-edit/images/";
const imageDirectory = "images";
const imageName = String.raw`[0-9a-f]{64}\.(?:gif|jpg|png|webp)`;

const escapeForPattern = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\/]/gu, "\\$&");

const imageLinkPattern = (prefix: string): RegExp =>
  new RegExp(String.raw`\]\(${escapeForPattern(prefix)}(?<name>${imageName})(?=[\s)])`, "gu");

function repositoryImagePrefix(pagePath: string): string {
  const depth = pagePath.split("/").length - 1;
  return depth === 0 ? `./${imageDirectory}/` : `${"../".repeat(depth)}${imageDirectory}/`;
}

function toRepositoryImages(
  markdown: string,
  pagePath: string,
): Readonly<{ images: readonly string[]; markdown: string }> {
  const prefix = repositoryImagePrefix(pagePath);
  const images = new Set<string>();
  const rewritten = markdown.replaceAll(imageLinkPattern(editorImagePrefix), (_link, name) => {
    images.add(String(name));
    return `](${prefix}${String(name)}`;
  });
  return { images: [...images], markdown: rewritten };
}

function toEditorImages(markdown: string, pagePath: string): string {
  return markdown.replaceAll(
    imageLinkPattern(repositoryImagePrefix(pagePath)),
    (_link, name) => `](${editorImagePrefix}${String(name)}`,
  );
}

export { editorImagePrefix, imageDirectory, toEditorImages, toRepositoryImages };

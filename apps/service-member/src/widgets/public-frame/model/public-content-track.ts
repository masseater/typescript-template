const columnPaths = new Set([
  "/contact",
  "/login",
  "/signup",
  "/verify-email",
  "/verify-email-change",
]);

const publicContentTrack = (pathname: string): "max-w-column" | "max-w-page" => {
  return columnPaths.has(pathname) ? "max-w-column" : "max-w-page";
};

export { publicContentTrack };

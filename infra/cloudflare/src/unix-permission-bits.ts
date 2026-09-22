const GROUP_AND_OTHER_PERMISSIONS = 0o077;

function modeAllowsGroupOrOther(mode: number): boolean {
  return (mode & GROUP_AND_OTHER_PERMISSIONS) !== 0;
}

export { modeAllowsGroupOrOther };

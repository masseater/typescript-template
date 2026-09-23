const effectTsgoNoEmit = (project: string): string =>
  `"$(effect-tsgo get-exe-path)" --pretty false --noEmit -p ${project}`;

export { effectTsgoNoEmit };

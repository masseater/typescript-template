const descriptorApi = process.getBuiltinModule("fs") as {
  readonly closeSync: (descriptor: number) => void;
  readonly openSync: (location: string, flags: string) => number;
};

const openDescriptor = (location: string): number => descriptorApi.openSync(location, "r+");

const closeDescriptor = (descriptor: number): void => {
  descriptorApi.closeSync(descriptor);
};

export { closeDescriptor, openDescriptor };

const descriptorApi = process.getBuiltinModule("fs") as {
  readonly closeSync: (descriptor: number) => void;
  readonly openSync: (location: string, flags: string) => number;
  readonly writeSync: (descriptor: number, written: string) => number;
};

const openDescriptor = (location: string): number => descriptorApi.openSync(location, "r+");

const openWritableDescriptor = (location: string): number => descriptorApi.openSync(location, "w");

const writeDescriptor = (descriptor: number, written: string): number =>
  descriptorApi.writeSync(descriptor, written);

const closeDescriptor = (descriptor: number): void => {
  descriptorApi.closeSync(descriptor);
};

export { closeDescriptor, openDescriptor, openWritableDescriptor, writeDescriptor };

import type { ReactElement } from "react";

type KeyPress = Readonly<{
  key: string;
  nativeEvent: Readonly<{ isComposing: boolean }>;
  preventDefault: () => void;
  shiftKey: boolean;
}>;

function MessageBox({
  label,
  onSend,
  onValueChange,
  value,
}: Readonly<{
  label: string;
  onSend: () => void;
  onValueChange: (value: string) => void;
  value: string;
}>): ReactElement {
  function handleEditText(event: Readonly<{ target: Readonly<{ value: string }> }>): void {
    onValueChange(event.target.value);
  }
  function handleSendOnEnter(event: KeyPress): void {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  }
  return (
    <textarea
      aria-label={label}
      name="text"
      value={value}
      onChange={handleEditText}
      onKeyDown={handleSendOnEnter}
      className="box-border field-sizing-content min-h-16 w-full rounded-md border border-input bg-card px-1 py-1.5 text-base text-foreground outline-none focus-visible:focus-indicator"
    />
  );
}

export { MessageBox };

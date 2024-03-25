export interface SlotProps {
  inputValues?: { [key: string]: any };
}

export interface SlotRenderProps extends SlotProps {
  key?: string;
}

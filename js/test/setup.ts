Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: () => null });

Object.defineProperty(Blob.prototype, "text", {
  value(this: Blob): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(this);
    });
  },
});

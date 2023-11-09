export default class Pendding {
  dom: any
  canvas: any

  open(canvas: any) {
    if (!this.dom) {
      const div = document.createElement("div")
      this.canvas = canvas;
      this.dom = div
      div.style.position = 'absolute'
      div.style.width = "100%";
      div.style.height = "100%";
      div.style.top = '0';
      div.style.left = '0';
      div.style.zIndex = "100000";
      div.style.background = "#1b1b1b73";
      canvas.appendChild(div)
    }
    
  }
  close() {
    if (this.dom) {
      this.canvas.removeChild(this.dom)
      this.canvas = null
      this.dom = null
    }
  }
}

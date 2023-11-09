export default class Pendding {
  dom: any
  canvas: any

  constructor(canvas: any) {
    this.canvas = canvas
  }

  open() {
    if (!this.dom) {
      const div = document.createElement("div")
      this.dom = div
      div.style.position = 'absolute'
      div.style.width = "100%";
      div.style.height = "100%";
      div.style.top = '0';
      div.style.left = '0';
      div.style.zIndex = "100";
      div.style.background = "#1b1b1b73";
      this.canvas.appendChild(div)
    }
    
  }
  close() {
    if (this.dom) {
      this.canvas.removeChild(this.dom)
      this.dom = null
    }
  }
}

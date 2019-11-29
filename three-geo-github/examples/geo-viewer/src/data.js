
export default class Geologydata {
  constructor(rangeBox) {
    this.rangeBox = rangeBox;
    this.array = [
      '../data/china.json',
      { 'name': '沉积层', 'extrude': 0.2, 'texture': '../data/textures/test.jpg' },
      { 'name': '石灰岩', 'extrude': 0.2, 'texture': '../data/textures/rock2.jpg' },
      { 'name': '富水层', 'extrude': 0.2, 'texture': '../data/textures/water.jpg' },
      { 'name': '火山岩', 'extrude': 0.2, 'texture': '../data/textures/rock3.jpg' }
    ]

  }

}
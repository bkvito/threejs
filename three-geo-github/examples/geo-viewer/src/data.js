
export default class Geologydata {
  constructor(rangeBox) {
    this.rangeBox = rangeBox;
    this.array = [
      '../data/china.json',
      { 'name': '沉积层', 'extrude': 0.2, 'texture': ['../data/textures/last/1-1.png', '../data/textures/last/1-3.png', '../data/textures/last/1-2.png', '../data/textures/last/1-4.png', '../data/textures/china.png', '../data/textures/china.png'] },
      { 'name': '石灰岩', 'extrude': 0.2, 'texture': ['../data/textures/last/2-1.png', '../data/textures/last/2-3.png', '../data/textures/last/2-2.png', '../data/textures/last/2-4.png', '../data/textures/china.png', '../data/textures/china.png'] },
      { 'name': '火山岩', 'extrude': 0.2, 'texture': ['../data/textures/last/3-1.png', '../data/textures/last/3-3.png', '../data/textures/last/3-2.png', '../data/textures/last/3-4.png', '../data/textures/china.png', '../data/textures/china.png'] },
      { 'name': '富水层', 'extrude': 0.2, 'texture': ['../data/textures/last/4-1.png', '../data/textures/last/4-3.png', '../data/textures/last/4-2.png', '../data/textures/last/4-4.png', '../data/textures/china.png', '../data/textures/china.png'] }
    ]

  }

}
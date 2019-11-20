
export default class Geologydata {
  constructor(rangeBox) {
    this.rangeBox = rangeBox;
    this.array = [
      '../data/china.json',
      { 'name': 'name1', 'extrude': 0.2, 'texture': '../data/textures/rock1.jpg' },
      { 'name': 'name2', 'extrude': 0.1, 'texture': '../data/textures/rock2.jpg' },
      { 'name': 'name3', 'extrude': 0.02, 'texture': '../data/textures/water.jpg' },
      { 'name': 'name4', 'extrude': 0.3, 'texture': '../data/textures/rock3.jpg' }
    ]

  }

}
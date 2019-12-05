import * as d3 from 'd3-geo';
// import Viewer from './viewer.js';


const THREE = window.THREE;
import * as turf from '@turf/centroid';



// 初始化一个场景
export default class ThreeMap {
  constructor(set) {
    this.mapData = set.mapData;
    this.color = '#006de0';
    //this.colors = ['#fff', '#ff0'];
    this.colorIndex = 0;
    //this.textures = [new THREE.TextureLoader().load(img1), new THREE.TextureLoader().load(img2)];
    this.pointsLength = 20;
    this.init();
  }

  /**
   * @desc 初始化场景
   */
  init() {
    // this.scene = new THREE.Scene();
    // this.camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 1, 1000);

    // this.setCamera({ x: 100, y: 0, z: 100 });
    // this.setLight();
    // this.setRender();

    // this.setHelper();

    this.drawMap();

    // this.setControl();
    // this.animate();

    document.body.addEventListener('click', this.mouseEvent.bind(this));
  }

  /**
   * @desc 鼠标事件处理
   */
  mouseEvent(event) {
    if (!this.raycaster) {
      this.raycaster = new THREE.Raycaster();
    }
    if (!this.mouse) {
      this.mouse = new THREE.Vector2();
    }
    if (!this.meshes) {
      this.meshes = [];
      this.group.children.forEach(g => {
        g.children.forEach(mesh => {
          this.meshes.push(mesh);
        });
      });
    }

    // 将鼠标位置归一化为设备坐标。x 和 y 方向的取值范围是 (-1 to +1)
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 通过摄像机和鼠标位置更新射线
    //this.raycaster.setFromCamera(this.mouse, this.camera);

    // 计算物体和射线的焦点
    const intersects = this.raycaster.intersectObjects(this.meshes);
    if (intersects.length > 0) {
      this.clickFunction(event, intersects[0].object.parent);
    }
  }

  /**
   * @desc 设置区域颜色
   */
  setAreaColor(g, color = '#ff0') {
    // 恢复颜色
    g.parent.children.forEach(gs => {
      gs.children.forEach(mesh => {
        mesh.material.color.set(this.color);
      });
    });

    // 设置颜色
    g.children.forEach(mesh => {
      mesh.material.color.set(color);
    });
  }

  /**
   * @desc 绑定事件
   */
  on(eventName, func) {
    if (eventName === 'click') {
      this.clickFunction = func;
    }
  }

  /**
   * @desc 绘制地图
   */
  drawMap() {
    console.log(this.mapData);
    if (!this.mapData) {
      console.error('this.mapData 数据不能是null');
      return;
    }
    // 把经纬度转换成x,y,z 坐标
    this.mapData.features.forEach(d => {
      d.vector3 = [];
      d.geometry.coordinates.forEach((coordinates, i) => {
        d.vector3[i] = [];
        coordinates.forEach((c, j) => {
          if (c[0] instanceof Array) {
            d.vector3[i][j] = [];
            c.forEach(cinner => {
              let cp = this.lnglatToMector(cinner);
              d.vector3[i][j].push(cp);
            });
          } else {
            let cp = this.lnglatToMector(c);
            d.vector3[i].push(cp);
          }
        });
      });
    });

    console.log(this.mapData);
    this.mapData.features = this.mapData.features.splice(31, 1)//移除多余geojosn
    //this.mapData.features[0].vector3=[[[-0.5422318350292201, 0.8743065808350237],[0.5996181675534342, 0.8743065808350237],[0.5996181675534342, -0.8407290386369067],[-0.5422318350292201,-0.8407290386369067]]]//[1,1,-1],[-1,1,-1],[-1,-1,-1],[1,-1,-1]
    this.mapData.features[0].vector3 = [this.mapData.rangeBox]



    console.log(turf)

    // 绘制地图模型
    const group = new THREE.Group();
    //const lineGroup = new THREE.Group();
    this.mapData.features.forEach(d => {
      const g = new THREE.Group(); // 用于存放每个地图模块。||省份
      group.data = d;
      d.vector3.forEach(points => {
        // 多个面
        if (points[0][0] instanceof Array) {
          points.forEach(p => {
            const mesh = this.drawModel(p);
            //const lineMesh = this.drawLine(p);
            // lineGroup.add(lineMesh);
            mesh.name = this.mapData.dataName;
            //group.add(mesh);
            g.add(mesh);
            window.viewer.objsInteractive.push(mesh)
          });
        } else {
          // 单个面
          const mesh = this.drawModel(points);
          mesh.name = this.mapData.dataName;
          window.viewer.objsInteractive.push(mesh)

          //const lineMesh = this.drawLine(points);
          //lineGroup.add(lineMesh);
          // group.add(mesh);
          g.add(mesh);
        }
      });
      group.add(g);
    });
    this.group = group; // 丢到全局去
    // const lineGroupBottom = lineGroup.clone();
    // lineGroupBottom.position.z = -1;
    // this.scene.add(lineGroup);
    // this.scene.add(lineGroupBottom);
    // this.scene.add(group);

    // viewer.scene.add(lineGroup);
    // viewer.scene.add(lineGroupBottom);


    group.name = "Layer" + window.viewer.layerAmount
    //根据已加载图层个数确定当前图层加载位置，按照从上到下的顺序加载图层
    group.position.z = this.mapData.layerId == 1 ? 0 : window.viewer.layerPosition//window.viewer.layerAmount ==0 ? -0.1: -window.viewer.layerAmount*0.1-0.1
    window.viewer.label_Zposition.push(window.viewer.layerPosition)
    window.viewer.layerPosition -= this.mapData.dataExtrude
    window.viewer.scene.add(group);
    window.viewer.layerAmount += 1
    window.viewer._render()
  }

  /**
   * @desc 绘制线条
   * @param {} points
   */
  drawLine(points) {
    const material = new THREE.LineBasicMaterial({
      color: '#ccc',
      transparent: true,
      opacity: 0.7
    });
    const geometry = new THREE.Geometry();
    points.forEach(d => {
      const [x, y, z] = d;
      geometry.vertices.push(new THREE.Vector3(x, y, z + 0));
    });
    const line = new THREE.Line(geometry, material);
    return line;
  }

  /**
   * @desc 绘制地图模型 points 是一个二维数组 [[x,y], [x,y], [x,y]]
   */
  drawModel(points) {
    const shape = new THREE.Shape();
    points.forEach((d, i) => {
      const [x, y] = d;
      if (i === 0) {
        shape.moveTo(x, y);
      } else if (i === points.length - 1) {
        shape.quadraticCurveTo(x, y, x, y);
      } else {
        shape.lineTo(x, y, x, y);
      }
    });
    // debugger
    //shape = viewer.mapShape

    const geometry = new THREE.ExtrudeGeometry(shape, {
      //amount: -1,
      depth: -this.mapData.dataExtrude,
      bevelEnabled: false
    });
    // const length = Math.abs(this.mapData.rangeBox[0][0][0])+Math.abs(this.mapData.rangeBox[0][1][0])
    // const geometry = new THREE.BoxGeometry(length,length,this.mapData.dataExtrude)





    // var mycolor = new THREE.Color()
    // mycolor.fromArray(new Float32Array([Math.random(), Math.random(), Math.random()]));

    //加载纹理图片
    // var loader = new THREE.TextureLoader()
    // var texture = loader.load(this.mapData.texture);
    var texture = new THREE.TextureLoader().load(this.mapData.texture);
    // texture.wrapS = THREE.ClampToEdgeWrapping;
    // texture.wrapT = THREE.ClampToEdgeWrapping;
    // texture.wrapS = THREE.RepeatWrapping;
    // texture.wrapT = THREE.RepeatWrapping;
    // texture.repeat.set(1, 1);


    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    // const material = new THREE.MeshBasicMaterial({
    //   color: mycolor,
    //   transparent: false,
    //   opacity: 0.9,
    //   side: THREE.DoubleSide
    // });
    this.caculateGeometryUv(geometry)
    const mesh = new THREE.Mesh(geometry, material);

    return mesh;
  }
  caculateGeometryUv(geometry) {
    geometry.computeBoundingBox();
    var max = geometry.boundingBox.max,
      min = geometry.boundingBox.min;
    var offset = new THREE.Vector2(0 - min.x, 0 - min.y);
    var range = new THREE.Vector2(max.x - min.x, max.y - min.y);
    var faces = geometry.faces;
    geometry.faceVertexUvs[0] = [];
    for (var i = 0; i < faces.length; i++) {
      var v1 = geometry.vertices[faces[i].a],
        v2 = geometry.vertices[faces[i].b],
        v3 = geometry.vertices[faces[i].c];
      geometry.faceVertexUvs[0].push([
        new THREE.Vector2((v1.x + offset.x) / range.x, (v1.y + offset.y) / range.y),
        new THREE.Vector2((v2.x + offset.x) / range.x, (v2.y + offset.y) / range.y),
        new THREE.Vector2((v3.x + offset.x) / range.x, (v3.y + offset.y) / range.y)
      ]);
    }
    geometry.uvsNeedUpdate = true;
  }





  /**
   * @desc 经纬度转换成墨卡托投影
   * @param {array} 传入经纬度
   * @return array [x,y,z]
   */
  lnglatToMector(lnglat) {
    if (!this.projection) {
      this.projection = d3
        .geoMercator()
        .center([108.904496, 32.668849])
        .scale(80)
        .rotate(Math.PI / 4)
        .translate([0, 0]);
    }
    const [y, x] = this.projection([...lnglat]);
    let z = 0;
    return [x, y, z];
  }

  /**
   * @desc 动画
   */
  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // required if controls.enableDamping or controls.autoRotate are set to true
    this.controls.update();

    this.renderer.render(this.scene, this.camera);

    //this.doAnimate && this.doAnimate.bind(this)();
  }

  /**
   * @desc 设置控制器
   */
  setControl() {
    this.controls = new THREE.OrbitControls(this.camera);
    this.controls.update();
  }

  setHelper() {
    const axesHelper = new THREE.AxisHelper(50);
    this.scene.add(axesHelper);
  }
}

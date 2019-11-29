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
    

    const material = new THREE.MeshBasicMaterial({ map: texture,side: THREE.DoubleSide});
    // const material = new THREE.MeshBasicMaterial({
    //   color: mycolor,
    //   transparent: false,
    //   opacity: 0.9,
    //   side: THREE.DoubleSide
    // });
    
    var t0 = new THREE.Vector2(0, 0);//图片左下角
    var t1 = new THREE.Vector2(1, 0);//图片右下角
    var t3 = new THREE.Vector2(1, 1);//图片右上角
    var t2 = new THREE.Vector2(0, 1);//图片左上角
    let uv1 = [t0, t1, t2];//选中图片一个三角区域像素——映射到三角面1
    let uv2 = [t0, t2, t3];//选中图片一个三角区域像素——映射到三角面2
    geometry.faceVertexUvs[0]=[]
    //geometry.faceVertexUvs[0][0]= [t0, t1, t2];//纹理坐标传递给纹理三角面属性    
    geometry.faceVertexUvs[0].push([t0, t2, t3],[t3, t1, t0]);//[t0, t2, t3],
    //geometry.faceVertexUvs[0][1]= [t0, t3, t1]

    const mesh = new THREE.Mesh(geometry, material);


    // /**
    //      * 纹理贴图网格模型
    //      */
    // var geometry2 = new THREE.Geometry(); //创建一个空几何体对象
    // /**顶点坐标(纹理映射位置)*/
    // var p1 = new THREE.Vector3().fromArray(this.mapData.rangeBox[0][0]); //顶点1坐标
    // var p2 = new THREE.Vector3().fromArray(this.mapData.rangeBox[0][1]); //顶点2坐标
    // var p3 = new THREE.Vector3().fromArray(this.mapData.rangeBox[0][2]); //顶点3坐标
    // var p4 = new THREE.Vector3().fromArray(this.mapData.rangeBox[0][3]); //顶点4坐标
    // geometry2.vertices.push(p1, p2, p3, p4); //顶点坐标添加到geometry对象
    // /** 三角面1、三角面2*/
    // var normal = new THREE.Vector3(0, 0, 1); //三角面法向量
    // var face0 = new THREE.Face3(0, 1, 2, normal); //三角面1
    // var face1 = new THREE.Face3(0, 2, 3, normal); //三角面2
    // geometry2.faces.push(face0, face1); //三角面1、2添加到几何体
    // /**纹理坐标*/
    // var t0 = new THREE.Vector2(0, 0);//图片左下角
    // var t1 = new THREE.Vector2(1, 0);//图片右下角
    // var t2 = new THREE.Vector2(1, 1);//图片右上角
    // var t3 = new THREE.Vector2(0, 1);//图片左上角
    // let uv1 = [t0, t1, t2];//选中图片一个三角区域像素——映射到三角面1
    // let uv2 = [t0, t2, t3];//选中图片一个三角区域像素——映射到三角面2
    // geometry2.faceVertexUvs[0].push(uv1, uv2);//纹理坐标传递给纹理三角面属性
    // var texture2 = new THREE.TextureLoader().load(this.mapData.texture);//加载图片
    // var material2 = new THREE.MeshLambertMaterial({
    //   map: texture2,//纹理属性map赋值
    //   side: THREE.DoubleSide//两面可见
    // });//材质对象
    // var mesh2 = new THREE.Mesh(geometry2, material2);//纹理贴图网格模型对象
    // mesh2.name="hahha"
    // window.viewer.scene.add(mesh2);//纹理贴图网格模型添加到场景中

    return mesh;
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

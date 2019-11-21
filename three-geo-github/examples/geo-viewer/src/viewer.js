import ThreeGeo from '../../../src';

import Laser from 'three-laser-pointer/src';
import { util } from './util';

import MapHelper from './map-helper.js';
import queryString from 'query-string'; // in prod, need webpack-4 to minify this
import Geologydata from './data.js';
// import ThreeMapLightBar from './ThreeMapLightBar.js';
import ThreeMap from './ThreeMap.js';

class Viewer {
    constructor(env, threelet) {
        this.env = env;
        this.layerAmount = 0//记录viewer中加载的图层的数量
        this.layerPosition = 0//记录图层z轴位置
        this.demTileBorder = undefined;//存储每个瓦片的外边界点，用于生成边界面
        this.label_Zposition = [0]// 记录每个地质层的z轴值

        const { camera, renderer } = threelet;
        this.threelet = threelet;
        this.camera = camera;
        this.renderer = renderer;

        this.guiHelper = null;

        this.scene = new THREE.Scene();
        this.sceneMeasure = new THREE.Scene();
        window.viewer = this
        this.loader = new THREE.FileLoader();
        this.geologyMap = new Map()


        //======== add light
        if (0) {
            // https://github.com/mrdoob/three.js/blob/master/examples/webvr_cubes.html
            this.scene.add(new THREE.HemisphereLight(0x606060, 0x404040));
            const light = new THREE.DirectionalLight(0xffffff);
            light.position.set(0, 0, 1).normalize();
            this.scene.add(light);
        }

        //======== add sub-camera
        if (0) {
            const cam = new THREE.PerspectiveCamera(60, 1, 0.01, 0.5);
            this.scene.add(new THREE.CameraHelper(cam));
            cam.position.set(0, 0, 2);
            cam.rotation.x = Math.PI / 4;
            cam.updateMatrixWorld();  // reflect pose change to CameraHelper
        }

        //======== add walls and axes
        const walls = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxBufferGeometry(1, 1, 1)),
            new THREE.LineBasicMaterial({ color: 0xcccccc }));
        walls.position.set(0, 0, 0);
        walls.name = "singleton-walls";
        this.scene.add(walls);

        const axes = new THREE.AxesHelper(1);
        axes.name = "singleton-axes";
        this.scene.add(axes);

        //======== add laser
        this._laser = new Laser({
            color: 0xffffff,
        });
        this._laser.name = 'singleton-laser-vr';
        this.scene.add(this._laser);

        // ======== adding geo tiles
        this.renderer.autoClear = false;

        this.wireframeMat = new THREE.MeshBasicMaterial({
            wireframe: true,
            color: 0x999999,
        });
        this.satelliteMats = {};
        this.objsInteractive = [];
        this._isRgbDemLoaded = false;
        this._isVectorDemLoaded = false;
        this.unitsSide = 1.0;

        this.tgeo = new ThreeGeo({
            unitsSide: this.unitsSide,
            tokenMapbox: this.env.tokenMapbox,
        });

        // vector dem: 9--15 (at 8, no contour data returned)
        // rbg dem: ?--15 per https://www.mapbox.com/help/access-elevation-data/#mapbox-terrain-rgb
        // satellite zoom resolution -- min: 11, defaut: 13, max: 17
        this._zoom = this.env.zoom || 13;
        this._radius = 5.0 * 2 ** (13 - this._zoom);
        let query = Viewer.parseQuery();
        this._origin = query.origin;
        this._vis = query.mode;

        this._debugLoading = this.env.debugLoading === true;
        this._debugTitleLast = 'invalid';
        if (this._debugLoading) { // use cache for debug....
            this._setApiDebug(this.tgeo, query.title);
        }

        this.updateTerrain(this._vis);

        this._projection = this.tgeo.getProjection(this._origin, this._radius);

        // ------- leaflet stuff
        this.mapHelper = new MapHelper({
            origin: this._origin,
            radius: this._radius,
            projection: this._projection,
            mapId: 'map',
            enableTiles: env.enableTilesLeaflet === true,
            onBuildTerrain: (ll) => { this.reloadPageWithLocation(ll); },
            onMapZoomEnd: () => { this.plotCamInMap(this.camera); },
            addGeologyLayer: this.addGeologyLayer
        });
        // console.log('this.mapHelper:', this.mapHelper);

        // ------- msg stuff
        this.$msg = $('#msg');
        this.$msgMeasure = $('#msgMeasure');
        this.$msgTerrain = $('#msgTerrain');


        // tmp laser for measurement
        this._laserMarkTmp = new Laser({ maxPoints: 2 });
        this._laserMarkTmp.name = 'singleton-measure-mark-tmp';
        this.sceneMeasure.add(this._laserMarkTmp);

        this.markPair = []; // now this.markPair.length === 0
        this._laserMarkColor = null;

        // ------- marker stuff
        this._laserMarker = new Laser({ maxPoints: 2 });
        this._laserMarker.visible = false;
        this._laserMarker.name = 'singleton-marker';
        this.scene.add(this._laserMarker);

        // ------- orbit stuff -------
        this._orbit = null;
        this._isOrbiting = false;

        this._showVrLaser = false;
    } // end constructor()

    static parseQuery() {
        let _parsedQ = queryString.parse(location.search);
        console.log('_parsedQ:', _parsedQ);

        let _origin, _title;
        if (_parsedQ.lat && _parsedQ.lng) {
            _origin = [Number(_parsedQ.lat), Number(_parsedQ.lng)];
            _title = _parsedQ.title;
        } else {
            console.log('enforcing the default location...');
            // _origin = [36.2058, -112.4413];
            // _parsedQ.title = "Colorado River";
            _origin = [28.44937385955666, 100.2667236328125]; // 地图默认中心点
            _title = "Table Mountain";
        }

        let _mode = _parsedQ.mode;
        _mode = _mode ? this.capitalizeFirst(_mode.toLowerCase()) : "卫星";

        return {
            origin: _origin,
            title: _title,
            mode: _mode,
        };
    }
    static capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // loading stuff --------
    static _disposeMaterial(mat) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
    }
    static _disposeObject(obj) { // cf. https://gist.github.com/j-devel/6d0323264b6a1e47e2ee38bc8647c726
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) this._disposeMaterial(obj.material);
        if (obj.texture) obj.texture.dispose();
    }
    clearTerrainObjects() {
        this.renderer.dispose(); // cf. https://gist.github.com/j-devel/6d0323264b6a1e47e2ee38bc8647c726

        // this.
        //    this.wireframeMat                        intact
        //    this.objsInteractive               vv    to be cleared
        //    this._isRgbDemLoaded               vv    to be set false
        //    this._isVectorDemLoaded            vv    to be set false
        //    ::::this.satelliteMats             vv    to be cleared
        //        dem-rgb-12/2257/2458        vv    to be cleared
        //        dem-rgb-12/2257/2459        vv    to be cleared
        //        ...                         vv
        //========
        this.objsInteractive.length = 0;
        //--
        this._isRgbDemLoaded = false;
        this._isVectorDemLoaded = false;
        //--
        Object.entries(this.satelliteMats).forEach(([k, mat]) => {
            delete this.satelliteMats[k];
            Viewer._disposeMaterial(mat);
        });

        // this.scene.children
        //::::Mesh walls                      intact
        //::::Mesh dem-rgb-...             vv   to be cleared
        //::::Line dem-vec-line-...        vv   to be cleared
        //::::Mesh dem-vec-shade-...       vv   to be cleared
        //::::Laser ""     orbit           vv   this._updateLaserMarker(null)
        //::::LineLoop ""  orbit           vv   this._removeOrbit()
        //::::Laser ""     pointer            intact
        //========
        this.scene.children.filter(
            obj => obj.name.startsWith('dem-'))
            .forEach(dem => {
                dem.parent.remove(dem);
                Viewer._disposeObject(dem);
            });
        //--
        this._updateLaserMarker(null);
        //--
        this._removeOrbit();
        this.mapHelper.plotOrbit(null);
        if (this.guiHelper) {
            this.guiHelper.autoOrbitController.setValue(false);
        }
        //--

        // this.sceneMeasure.children
        //::::Laser ""     this._laserMarkTmp   vv   this._updateLaserMarkTmp(null)
        //::::Laser ""     measure         vv   to be cleared
        //::::Laser ""     measure         vv   to be cleared
        //...                              vv
        //========
        this._updateLaserMarkTmp(null);
        //--
        this.sceneMeasure.children.filter(
            obj => obj.name.startsWith('measure-mark-'))
            .forEach(mark => {
                mark.parent.remove(mark);
                Viewer._disposeObject(mark);
            });
        //--
    }
    reloadPageWithLocation(ll, title = undefined) {
        let href = `./index.html?lat=${ll[0]}&lng=${ll[1]}`;
        if (title) {
            href += `&title=${title}`;
        }

        if (0) {
            window.location.href = href; // deprecated
        } else {
            // https://stackoverflow.com/questions/35395485/change-url-without-refresh-the-page/35395594
            // window.history.pushState(null, '', href);
            window.history.replaceState(null, '', href);

            this.clearTerrainObjects();
            this.clearDemBorder();
            this.clearGeologyLayer()
            this._render();
            if (1) {
                console.log('======== ========');
                console.log('this:', this);
                console.log('this.scene.children:', this.scene.children);
                console.log('this.sceneMeasure.children:', this.sceneMeasure.children);
                console.log('======== ========');
            }

            // update leaflet
            this.mapHelper.update(
                ll, this.tgeo.getProjection(ll, this._radius));
            this.plotCamInMap(this.camera);

            // update terrain
            this._origin = ll;
            this.showMsgTerrain();
            if (this._debugLoading) {
                this._setApiDebug(this.tgeo, title);
            }
            this.updateTerrain(this._vis);
        }
    }
    updateTerrain(vis) {
        switch (vis.toLowerCase()) {
            case "卫星"://satellite
                console.log('update to satellite');
                this.loadRgbDem(() => {
                    this._render();
                });
                break;
            case "三角网"://wireframe
                console.log('update to wireframe');
                this.loadRgbDem(() => {
                    // override the default satellite texture
                    this.updateMode("Wireframe");
                    this._render();
                });
                break;
            case "等高线"://contours
                console.log('update to contours');
                this.loadVectorDem(() => {
                    this._render();
                });
                break;
            default:
                break;
        }
    }
    _setApiDebug(tgeo, title) {
        // title is undefined when called via mapHelper.onBuildTerrain(ll)
        console.log('_setApiDebug(): title:', title);
        if (title) {
            this._debugTitleLast = title; // update the last
        } else {
            title = this._debugTitleLast; // use the last
        }
        let _location = 'invalid';
        if (title.includes('Table')) _location = 'table';
        if (title.includes('Eiger')) _location = 'eiger';
        if (title.includes('River')) _location = 'river';
        if (title.includes('Akagi')) _location = 'akagi';
        tgeo.setApiVector(`../cache/${_location}/mapbox-terrain-vector`);
        tgeo.setApiRgb(`../cache/${_location}/mapbox-terrain-rgb`);
        tgeo.setApiSatellite(`../cache/${_location}/mapbox-satellite`);
    }

    nop() { /* nop */ }
    loadRgbDem(cb = this.nop) {
        if (this._isRgbDemLoaded) { return cb(); }
        if (this.env.tokenMapbox === '********') {
            const msg = 'Please set a valid Mapbox token in env.js';
            console.log(msg);
            alert(msg);
            return cb();
        }

        this._isRgbDemLoaded = true;
        this.tgeo.getTerrain(this._origin, this._radius, this._zoom, {
            onRgbDem: (objs) => {
                // dem-rgb-<zoompos>
                objs.forEach((obj) => {
                    this.objsInteractive.push(obj);
                    this.scene.add(obj);
                    // console.log('obj:', obj);
                });
                this._render();
            },
            onSatelliteMat: (plane) => {
                plane.material.side = THREE.DoubleSide;
                this.satelliteMats[plane.name] = plane.material;
                this._render();
                return cb();
            },
            //生成外边界线
            onDemTileBorder: (dataEleCovered) => {
                var bigBorder = []
                switch (dataEleCovered.length) {
                    case 4:
                        for (let i = 0; i < dataEleCovered.length; i++) {
                            var border = dataEleCovered[i][3].border[0]
                            if (i == 0) {
                                this.getLeft(bigBorder, border)
                                this.getTop(bigBorder, border)
                            } else if (i == 1) {
                                this.getLeft(bigBorder, border)
                                this.getBottom(bigBorder, border)
                            } else if (i == 2) {
                                this.getRight(bigBorder, border)
                                this.getTop(bigBorder, border)
                            } else {
                                this.getRight(bigBorder, border)
                                this.getBottom(bigBorder, border)
                            }
                        }
                        break;
                    case 6:
                        if (dataEleCovered[0][0][2] == dataEleCovered[2][0][2]) {
                            //2行瓦片时
                            for (let i = 0; i < dataEleCovered.length; i++) {
                                var border = dataEleCovered[i][3].border[0]
                                if (i == 0) {
                                    this.getTop(bigBorder, border)
                                    this.getLeft(bigBorder, border)
                                } else if (i == 1) {
                                    this.getBottom(bigBorder, border)
                                    this.getLeft(bigBorder, border)
                                } else if (i == 2) {
                                    this.getTop(bigBorder, border)

                                } else if (i == 3) {
                                    this.getBottom(bigBorder, border)
                                } else if (i == 4) {
                                    this.getRight(bigBorder, border)
                                    this.getTop(bigBorder, border)
                                } else {
                                    this.getBottom(bigBorder, border)
                                    this.getRight(bigBorder, border)
                                }
                            }
                        } else {
                            //3行瓦片时
                            for (let i = 0; i < dataEleCovered.length; i++) {
                                var border = dataEleCovered[i][3].border[0]
                                if (i == 0) {
                                    this.getTop(bigBorder, border)
                                    this.getLeft(bigBorder, border)
                                } else if (i == 1) {
                                    this.getLeft(bigBorder, border)
                                } else if (i == 2) {
                                    this.getLeft(bigBorder, border)
                                    this.getBottom(bigBorder, border)
                                } else if (i == 3) {
                                    this.getRight(bigBorder, border)
                                    this.getTop(bigBorder, border)
                                } else if (i == 4) {
                                    this.getRight(bigBorder, border)
                                } else {
                                    this.getRight(bigBorder, border)
                                    this.getBottom(bigBorder, border)
                                }
                            }
                        }

                        break;
                    case 9:
                        for (let i = 0; i < dataEleCovered.length; i++) {
                            var border = dataEleCovered[i][3].border[0]
                            if (i == 0) {
                                this.getTop(bigBorder, border)
                                this.getLeft(bigBorder, border)

                            } else if (i == 1) {
                                this.getLeft(bigBorder, border)
                            } else if (i == 2) {
                                this.getLeft(bigBorder, border)
                                this.getBottom(bigBorder, border)
                            } else if (i == 3) {
                                this.getTop(bigBorder, border)
                            } else if (i == 4) {
                                continue
                            } else if (i == 5) {
                                this.getBottom(bigBorder, border)
                            } else if (i == 6) {
                                this.getTop(bigBorder, border)
                                this.getRight(bigBorder, border)
                            } else if (i == 7) {
                                this.getRight(bigBorder, border)
                            } else {
                                this.getRight(bigBorder, border)
                                this.getBottom(bigBorder, border)
                            }
                        }
                        break;
                }
                var group = new THREE.Group()
                group.name = "demTileBorderLineCollection"
                for (var i = 0; i < bigBorder.length; i++) {
                    var material = new THREE.LineBasicMaterial({
                        color: 0x0000ff
                    });

                    var geometry = new THREE.Geometry();
                    geometry.vertices.push(
                        new THREE.Vector3(bigBorder[i][0], bigBorder[i][1], bigBorder[i][2]),
                        new THREE.Vector3(bigBorder[i][0], bigBorder[i][1], 0)
                    );
                    var line = new THREE.Line(geometry, material);

                    group.add(line)

                }
                this.scene.add(group);


                this._render();
            },
            onGeologyLayer: (dataEleCovered) => {
                //console.log(demTileBorder)
                var leftTop = dataEleCovered[0][3].border[0][0]//左上
                var rightBottom = dataEleCovered[dataEleCovered.length - 1][3].border[0][507]//右下
                this.demTileBorder = [[leftTop, [rightBottom[0], leftTop[1]], rightBottom, [leftTop[0], rightBottom[1]]]]// 左上 右上 右下 左下
                var mydata = new Geologydata(this.demTileBorder)
                mydata.array.splice(1, 0, mydata.rangeBox)
                //var mydata = array.outputData(this.demTileBorder)
                mydata = mydata.array
                var font = undefined
                var loader = new THREE.FontLoader();
                font = loader.load('../assets/fonts/optimer_bold.typeface.json', function (response) {
                    font = response;
                    let textGeo = new THREE.TextGeometry("text", {
                        font: font,
                        size: 200,
                        height: 50,
                        curveSegments: 4,
                        bevelThickness: 2,
                        bevelSize: 1.5,
                        bevelEnabled: true
                    });
                    textGeo.computeBoundingBox();
                    textGeo.computeVertexNormals();
                    //var centerOffset = - 0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);
                    textGeo = new THREE.BufferGeometry().fromGeometry(textGeo);
                    let materials = [
                        new THREE.MeshPhongMaterial({ color: 0xff5f9f, flatShading: true }), // front
                        new THREE.MeshPhongMaterial({ color: 0xff5ff9 }) // side
                    ];
                    let textMesh = new THREE.Mesh(textGeo, materials);
                    textMesh.position.x = 0;
                    textMesh.position.y = 0;
                    textMesh.position.z = 0;
                    //textMesh1.rotation.y = Math.PI * 2;
                    viewer.scene.add(textMesh);
                    viewer._render()
                })
                for (let i = 0; i < mydata.length - 2; i++) {
                    jQuery.get(mydata[0], d => {
                        const mapData = util.decode(d);
                        mapData.dataExtrude = mydata[i + 2].extrude;
                        mapData.layerId = i + 1;
                        mapData.texture = mydata[i + 2].texture;
                        mapData.rangeBox = mydata[1];
                        mapData.dataName = mydata[i + 2].name;
                        this.geologyMap.set(mapData.dataName, { "地质名称": mydata[i + 2].name, "地址高度": mydata[i + 2].extrude })
                        const map = new ThreeMap({ mapData })//new ThreeMapLightBar({ mapData });
                        //let textMesh = this.createLabel(mapData.rangeBox, mapData.dataName, i)
                        // textMesh.position.x = mapData.rangeBox[0][0][0];
                        // textMesh.position.y = mapData.rangeBox[0][0][1];
                        // textMesh.position.z = this.label_Zposition;
                        //textMesh.rotation.x = 0;
                        // map.on('click', (e, g) => {
                        //     console.log(g);
                        //     map.setAreaColor(g);//????
                        // });
                    })
                }
                this._render();
            }
        });
    }
    loadFont() {
        let font = null;

    }
    createLabel(rangeBox, text, i) {

        let textGeo = new THREE.TextGeometry(text, {
            font: font,
            size: 10,
            height: 10,
            curveSegments: 4,
            bevelThickness: 2,
            bevelSize: 1.5,
            bevelEnabled: true
        });
        textGeo.computeBoundingBox();
        textGeo.computeVertexNormals();
        //var centerOffset = - 0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);
        textGeo = new THREE.BufferGeometry().fromGeometry(textGeo);
        let materials = [
            new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true }), // front
            new THREE.MeshPhongMaterial({ color: 0xffffff }) // side
        ];
        let textMesh = new THREE.Mesh(textGeo, materials);
        textMesh.position.x = rangeBox[0][0][0];
        textMesh.position.y = rangeBox[0][0][1];
        textMesh.position.z = this.label_Zposition;
        //textMesh1.rotation.y = Math.PI * 2;
        this.scene.add(textMesh);
        return textMesh

        // let textGeo = new THREE.TextGeometry(text, {
        //     font: 'helvetiker',
        //     size: 10,
        //     height: 10,
        //     curveSegments: 4,
        //     bevelThickness: 2,
        //     bevelSize: 1.5,
        //     bevelEnabled: true
        // });
        // textGeo.computeBoundingBox();
        // textGeo.computeVertexNormals();
        // //var centerOffset = - 0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);
        // textGeo = new THREE.BufferGeometry().fromGeometry(textGeo);
        // let materials = [
        //     new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true }), // front
        //     new THREE.MeshPhongMaterial({ color: 0xffffff }) // side
        // ];
        // let textMesh = new THREE.Mesh(textGeo, materials);

        // //textMesh1.rotation.y = Math.PI * 2;
        // this.scene.add(textMesh);
        // return textMesh

    }
    loadVectorDem(cb = this.nop) {
        if (this._isVectorDemLoaded) { return cb(); }
        if (this.env.tokenMapbox === '********') {
            console.log('Please set a valid Mapbox token in env.js');
            return cb();
        }

        console.log('load vector dem: start');
        this._isVectorDemLoaded = true;
        this.tgeo.getTerrain(this._origin, this._radius, this._zoom, {
            onVectorDem: (objs) => {
                console.log('load vector dem: end');
                // dem-vec-shade-<ele>-* and dem-vec-line-<ele>-*
                objs.forEach((obj) => {
                    this.scene.add(obj);
                });
                this._render();
                return cb();
            },
        });
    }

    // marker stuff --------
    _updateLaserMarker(pt = null) {
        if (pt) {
            this._laserMarker.setSource(pt);
            this._laserMarker.point(pt.clone().setZ(pt.z + 1.0), 0xff00ff);
            this._laserMarker.visible = true;
        } else {
            this._laserMarker.clearPoints();
            this._laserMarker.visible = false;
        }
    }
    _updateLaserMarkTmp(pt0 = null, pt1 = null, color = 0xffffff) {
        if (pt0) {
            this._laserMarkTmp.setSource(pt0);
            this._laserMarkTmp.point(pt1, color);
            this._laserMarkTmp.visible = true;
        } else {
            this.markPair.length = 0; // now this.markPair.length === 0
            this._laserMarkTmp.visible = false;
        }
    }

    static _calcOrbit(cam, pt) {
        let campos = cam.position.clone();

        // shrink the cone by 5 meters so the orbit is visible to the cam
        // let shift = pt.clone().sub(campos).normalize().multiplyScalar(0.005);
        //----
        let shift = new THREE.Vector3(0, 0, 0);

        let camposShifted = campos.add(shift);

        let center = pt.clone().setZ(camposShifted.z);
        let rvec = new THREE.Vector2(
            camposShifted.x - pt.x,
            camposShifted.y - pt.y);
        return {
            center: center,
            rvec: rvec,
            target: pt.clone(),
        };
    }
    _addOrbit(orbit, segments = 128) {
        let radius = orbit.rvec.length();
        let geom = new THREE.CircleGeometry(radius, segments);
        geom.vertices.shift(); // remove the center vertex
        this._orbit = new THREE.LineLoop(geom,
            new THREE.LineBasicMaterial({ color: 0xff00ff }));
        this._orbit.position.set(orbit.center.x, orbit.center.y, orbit.center.z);
        this._orbit.userData.radius = radius;
        this._orbit.userData.target = orbit.target;
        this._orbit.userData.theta = Math.atan2(orbit.rvec.y, orbit.rvec.x);
        // console.log('theta ini:', this._orbit.userData.theta);

        this.scene.add(this._orbit);
        // console.log('this.scene:', this.scene);
    }
    _removeOrbit() {
        // console.log('this._orbit:', this._orbit);
        if (!this._orbit) return;

        this.scene.remove(this._orbit);
        this._orbit.geometry.dispose();
        this._orbit.material.dispose();
        this._orbit = null;
    }
    toggleOrbiting(tf) {
        this._isOrbiting = tf;
    }
    toggleVrLaser(tf) {
        this._showVrLaser = tf;
    }
    toggleGrids(tf) {
        this.scene.getObjectByName("singleton-walls").visible = tf;
        this.scene.getObjectByName("singleton-axes").visible = tf;
        this._render();
    }

    // laser casting stuff --------
    static _applyWithMeshesVisible(meshes, func) {
        // console.log('meshes:', meshes);

        // save mesh visibilities
        let visibilities = {};
        meshes.forEach((mesh) => {
            visibilities[mesh.uuid] = mesh.visible; // save
            mesh.visible = true; // forcing for raycast
        });

        let output = func(meshes);

        // restore mesh visibilities
        meshes.forEach((mesh) => {
            mesh.visible = visibilities[mesh.uuid]; // restore
        });

        return output;
    }
    _doRaycast(mx, my) {
        return Viewer._applyWithMeshesVisible(
            this.objsInteractive, (meshes) =>
            this.threelet.raycastFromMouse(mx, my, meshes));

    }

    updateMeasure(mx, my) {
        let isect = this._doRaycast(mx, my);
        //console.log(this.geologyMap.get(isect.object.name))
        if (isect !== null) {
            // console.log('isect:', isect);
            let pt = isect.point;
            // console.log('pt (measure):', pt);
            if (this.markPair.length === 1) {
                this.markPair.push(pt); // now this.markPair.length === 2
                // console.log('registering this.markPair:', this.markPair);
                let laser = new Laser({
                    maxPoints: 2,
                    color: this._laserMarkColor,
                });
                laser.updatePoints(this.markPair);
                laser.name = `measure-mark-${Date.now()}`;
                this.sceneMeasure.add(laser);

                //console.log(laser)
            } else { // when this.markPair.length === 0 or 2
                if (this.markPair.length == 2) {//当this.markPair长度为2时表示当前场景有一条线，清楚后在绘制新线


                    this.sceneMeasure.remove(this.sceneMeasure.children[1])
                    this._updateLaserMarkTmp(null)
                    this._render()



                }
                this.markPair = [pt]; // now this.markPair.length === 1
                this._laserMarkColor = 0x00ffff;
                // get a new random color
                // this._laserMarkColor = Math.floor(0xffffff * Math.random());
                // console.log('new color:', this._laserMarkColor);
            }
            // console.log('this.markPair:', this.markPair);
        } else {
            this._updateLaserMarkTmp(null); // now this.markPair.length === 0
        }

        if (this.guiHelper && !this.guiHelper.data.autoOrbit) this._render();

        this.showMeasureStats(this.markPair);
    }
    getIntersectMesh(mx, my) {
        let intersectObj = this._doRaycast(mx, my);
        let objProperty = this.geologyMap.get(intersectObj.object.name)
        console.log(objProperty)
    }
    updateOrbit(mx, my) {
        let isect = this._doRaycast(mx, my);

        if (isect !== null) {
            // console.log('isect:', isect);
            let pt = isect.point;
            // console.log('pt (orbit):', pt);
            // console.log('meshHit:', isect.object.name);

            this._updateLaserMarker(pt);
            this._removeOrbit();
            this._addOrbit(Viewer._calcOrbit(this.camera, pt));
            this.mapHelper.plotOrbit(this._orbit);
        } else {
            console.log('no isects (orbit)');
            this._updateLaserMarker(null);
            this._removeOrbit();
            this.mapHelper.plotOrbit(null);
            if (this.guiHelper) {
                this.guiHelper.autoOrbitController.setValue(false);
            }
        }

        if (this.guiHelper && !this.guiHelper.data.autoOrbit) this._render();
    }
    hasOrbit() {
        return this._orbit !== null;
    }
    setOrbitDefault() {
        this._removeOrbit();
        this._addOrbit(Viewer._calcOrbit(this.camera, new THREE.Vector3(0, 0, 0)));
        this.mapHelper.plotOrbit(this._orbit);
    }
    pick(mx, my) {
        if (!this._showVrLaser && this.markPair.length !== 1) {
            return;
        }

        let isect = this._doRaycast(mx, my);
        if (isect !== null) {
            // console.log('isect:', isect);
            let pt = isect.point;
            // console.log('pt:', pt);

            let ptSrc = new THREE.Vector3(0.003, -0.004, 0.002);
            this._laser.setSource(ptSrc, this.camera);
            if (this._showVrLaser) {
                // this._laser.point(pt, 0xffffff);
                //----
                Viewer._applyWithMeshesVisible(
                    this.objsInteractive, (meshes) =>
                    this._laser.pointWithRaytrace(pt, meshes, 0xffffff, 16));
            }

            if (this.markPair.length === 1) {
                this._updateLaserMarkTmp(this.markPair[0], pt, this._laserMarkColor);
            } else {
                this._updateLaserMarkTmp(null); // now this.markPair.length === 0
            }
        } else {
            // console.log('no isects');
            this._laser.clearPoints();
        }

        if (this.guiHelper && !this.guiHelper.data.autoOrbit) this._render();

        // = 1(src point) + #(reflection points) + 1(end point)
        // console.log('#points:', this._laser.getPoints().length);
    }
    clearPick() {//清除点
        this._laser.clearPoints();
    }
    toggleMap(tf) {
        this.mapHelper.toggle(tf);
    }
    plotCamInMap(cam) {
        this.mapHelper.plotCam(cam);
    }

    //======== ======== ======== ========

    render() {
        if (this._isOrbiting && this._orbit) {
            let pt = this._orbit.userData.target;
            let radius = this._orbit.userData.radius;
            let theta = this._orbit.userData.theta;
            this.camera.position.setX(pt.x + radius * Math.cos(theta));
            this.camera.position.setY(pt.y + radius * Math.sin(theta));

            if (1) {
                this.camera.lookAt(pt.x, pt.y, pt.z);
            } else {
                // look along the tangent
                this.camera.lookAt(
                    pt.x + radius * Math.cos(theta + 0.01),
                    pt.y + radius * Math.sin(theta + 0.01),
                    this.camera.position.z);
            }

            this._orbit.userData.theta += 0.01;

            this.showMsg(this.camera);
            this.plotCamInMap(this.camera);
        }
        this._render();
    }

    static toCoords(vec, nFloats = 3) {
        return `(${vec.x.toFixed(nFloats)}, ${vec.y.toFixed(nFloats)}, ${vec.z.toFixed(nFloats)})`;
    }
    static toCoordsArray(vecArray) {
        return vecArray.map(vec => this.toCoords(vec)).join(', ');
    }
    static m2km(pt, unitsPerMeter) {
        return pt.clone().divideScalar(unitsPerMeter * 1000);
    }
    showMsg(cam) {
        const { unitsPerMeter } = this._projection;
        this.$msg.empty();
        this.$msg.append(`<div>相机位置: ${Viewer.toCoords(Viewer.m2km(cam.position, unitsPerMeter))}</div>`);
        // this.$msg.append(`<div>pos [km]: ${Viewer.toCoords(Viewer.m2km(cam.position, unitsPerMeter))}</div>`);
        this.$msg.append(`<div>相机朝向: ${Viewer.toCoords(cam.rotation)}</div>`);
        // this.$msg.append(`<div>rot [rad]: ${Viewer.toCoords(cam.rotation)}</div>`);
    }
    showMeasureStats(_markPair) {
        const { unitsPerMeter } = this._projection;
        this.$msgMeasure.empty();
        if (_markPair.length === 1) {
            this.$msgMeasure.append(`<div>起点: ${Viewer.toCoords(Viewer.m2km(_markPair[0], unitsPerMeter))} -> </div>`);
        } else if (_markPair.length === 2) {
            const p0km = Viewer.m2km(_markPair[0], unitsPerMeter);
            const p1km = Viewer.m2km(_markPair[1], unitsPerMeter);
            this.$msgMeasure.append(`<div>起止点: ${Viewer.toCoords(p0km)} -> ${Viewer.toCoords(p1km)}</div>`);
            this.$msgMeasure.append(`<div>直线距离: ${p0km.distanceTo(p1km).toFixed(3)}</div>`);
        }
    }
    showMsgTerrain() {
        const ll = this._origin;
        this.$msgTerrain.empty();
        this.$msgTerrain.append(`<div>经纬度: (${ll[0].toFixed(4)}, ${ll[1].toFixed(4)})</div>`);
        this.$msgTerrain.append(`<div>卫星分辨率: ${this._zoom}</div>`);
        // this.$msgTerrain.append(`<div>lat lng: (${ll[0].toFixed(4)}, ${ll[1].toFixed(4)})</div>`);
        // this.$msgTerrain.append(`<div>satellite zoom resolution [11-17]: ${this._zoom}</div>`);
    }

    //======== ======== ======== ========
    updateMode(vis) {
        this._vis = vis;
        this.scene.traverse((node) => {
            if (!(node instanceof THREE.Mesh) &&
                !(node instanceof THREE.Line)) return;

            // console.log(node.name);
            if (!node.name) return;

            if (node.name.startsWith('dem-rgb-')) {
                // console.log(`updating vis of ${node.name}`);
                if (vis === "卫星" && node.name in this.satelliteMats) { //Satellite
                    node.material = this.satelliteMats[node.name];
                    node.material.needsUpdate = true;
                    node.visible = true;
                } else if (vis === "三角网") { //Wireframe
                    node.material = this.wireframeMat;
                    node.material.needsUpdate = true;
                    node.visible = true;
                } else if (vis === "等高线") { //Contours
                    node.visible = false;
                }
            } else if (node.name.startsWith('dem-vec-')) {
                node.visible = vis === "等高线"; //Contours
            }
        });
    }
    setGuiHelper(helper) {
        this.guiHelper = helper;
    }
    closeGui() {
        this.guiHelper.gui.close();
    }
    _render() {
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
        this.renderer.clearDepth();
        this.renderer.render(this.sceneMeasure, this.camera);
    }
    capture() {
        this.threelet.capture();
    }


    clearDemBorder() {
        var obj = this.scene.getObjectByName("demTileBorderLineCollection")
        this.scene.remove(obj)
        //Viewer._disposeObject(obj)
    }
    clearGeologyLayer() {
        this.renderer.dispose()
        this.scene.children.filter(
            obj => obj.name.startsWith('Layer'))
            .forEach(Layer => {
                this.scene.remove(Layer)
            });
        //Viewer._disposeObject(Layer)
        this.layerPosition = 0
        window.viewer.layerAmount = 0
    }
    getTop(bigBorder, border) {
        bigBorder.push.apply(bigBorder, border.slice(0, 128))
        // var newArray = border.slice(128, 381)
        // newArray.forEach((x, index) => {
        //     if (index % 2 == 0) { bigBorder.push(x) }
        // })
    }
    getLeft(bigBorder, border) {
        var newArray = border.slice(128, 381)
        newArray.forEach((x, index) => {
            if (index % 2 == 0) { bigBorder.push(x) }
        })
        bigBorder.push(border[0])
    }
    getRight(bigBorder, border) {
        var newArray = border.slice(127, 381)
        newArray.forEach((x, index) => {
            if (index % 2 == 0) { bigBorder.push(x) }
        })
        bigBorder.push(border[507])
    }
    getBottom(bigBorder, border) {
        bigBorder.push.apply(bigBorder, border.slice(380))
    }






}

export default Viewer;

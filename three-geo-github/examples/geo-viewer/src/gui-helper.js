import DatGuiDefaults from 'dat-gui-defaults';

class GuiHelper extends DatGuiDefaults {
    constructor(env, data, callbacks = {}) {
        super(data);
        this.env = env;
        this.onChangeGrids = callbacks.onChangeGrids;
        this.onCapture = callbacks.onCapture;
        //----
        this.onChangeAutoOrbit = callbacks.onChangeAutoOrbit;
        this.onChangeVis = callbacks.onChangeVis;
        this.onChangeVrLaser = callbacks.onChangeVrLaser;
        this.onChangeLeaflet = callbacks.onChangeLeaflet;
        this.onChangeLoc = callbacks.onChangeLoc;
        this.onChangeObj = callbacks.onChangeObj;
    }

    // override
    initGui(gui, data, params) {
        this.locations = { // key: [lat, lng],
            "(none)": [0, 0], // dummy
            "北京": [39.9062, 116.3913],
            "成都": [30.7637, 103.8646],
            "上海": [31.2253, 121.4890],
            "深圳": [22.5446, 114.0545],
            "广州": [23.1302, 113.2593],
            // "Akagi": [36.5457, 139.1766],
            // "Cruach Ardrain": [56.3562, -4.5940],
            // "giza": [29.9791, 31.1342],
        };

        let controller;

        if (this.env.isDev) {
            controller = gui.add(params, 'isDev').name("isDev: true !!!!");
            controller.onChange((value) => {
                console.log('this.env:', this.env);
                if (1) {
                    const { origin, pathname } = window.location;
                    window.location.href = `${origin}${pathname}`;
                }
            });
        }

        let visItems = ["卫星", "三角网", "等高线"];
        controller = gui.add(params, 'vis', visItems).name('地形');
        controller.onChange((value) => {
            this.onChangeVis(value);
            data.vis = value;
        });

        controller = gui.add(params, 'capture').name("屏幕捕捉");
        controller.onChange((value) => {
            this.onCapture();
        });

        controller = gui.add(params, 'grids').name('线框');
        controller.onChange((value) => {
            this.onChangeGrids(value);
            data.grids = value;
        });

        controller = gui.add(params, 'autoOrbit').name('旋转');
        controller.onChange((value) => {
            this.onChangeAutoOrbit(value);
            data.autoOrbit = value;
        });
        this.autoOrbitController = controller;

        controller = gui.add(params, 'vrLaser').name('射线');
        controller.onChange((value) => {
            this.onChangeVrLaser(value);
            data.vrLaser = value;
        });
        controller = gui.add(params, 'flyObj').name('运动物体');
        controller.onChange((value) => {
            // this.onChangeVrLaser(value);
            // data.vrLaser = value;
            let obj = viewer.scene.getObjectByName('Sportsbox')
            if (!obj) {                
                document.getElementById("slideTest1").style.display = "block"
                let obj = new THREE.BoxGeometry(0.1, 0.1, 0.1)
                let material = new THREE.MeshBasicMaterial({ color: 0xffffff });
                let cube = new THREE.Mesh(obj, material);
                cube.position.set(-0.987204052597662, 0.7594052361994124, 1.2)
                cube.name = "Sportsbox"
                viewer.scene.add(cube);



                var tubeGeometry2 = new THREE.TubeGeometry(viewer.curve, 100, 0.001, 50, false);
                var tubeMaterial2 = new THREE.MeshPhongMaterial({
                    color: 0xffffff,
                    transparent: false,
                    opacity: 1,
                });
                var tube2 = new THREE.Mesh(tubeGeometry2, tubeMaterial2);
                tube2.name="tube2"
                viewer.scene.add(tube2)
            }else{
                document.getElementById("slideTest1").style.display = "none"
                let tube = viewer.scene.getObjectByName('tube2')
                obj.material.dispose()
                obj.geometry.dispose()
                tube.material.dispose()
                tube.geometry.dispose()
                viewer.scene.remove(obj)
                viewer.scene.remove(tube)
            }





        });

        if (0) {
            controller = gui.add(params, 'reset').name("Reset");
            controller.onChange((value) => {
                this.applyDefaults();
                this.onChangeVis(params.vis);
                this.onChangeAutoOrbit(params.autoOrbit);
                this.onChangeVrLaser(value);

                Object.assign(data, params);
            });
        }

        controller = gui.add(params, 'leaflet').name('鹰眼');
        controller.onChange((value) => {
            this.onChangeLeaflet(value);
            data.leaflet = value;
        });

        controller = gui.add(params, 'loc',
            Object.keys(this.locations)).name('定位');
        controller.onChange((value) => {
            this.onChangeLoc(value, this.locations);
            data.Loc = value;
        });

        controller = gui.add(params, 'sourceCode').name("源码");
        controller.onChange((value) => {
            window.location.href = "https://github.com/w3reality/three-geo/tree/master/examples/geo-viewer";
        });
    }
    animationObj(meshName, speed) {
        let aa = speed * 0.0005
        let mesh = this.scene.getObjectByName(meshName)
        if (aa == 0) this.instantaneousPosition = 0
        this.instantaneousPosition += aa
        var point = this.curve.getPoint(this.instantaneousPosition)
        mesh && mesh.position.set(point.x, point.y, point.z);
    }
}

export default GuiHelper;

import DatGuiDefaults from 'dat-gui-defaults';

class GuiHelper extends DatGuiDefaults {
    constructor(env, data, callbacks={}) {
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
    }

    // override
    initGui(gui, data, params) {
        this.locations = { // key: [lat, lng],
            "(none)": [0, 0], // dummy
            "北京": [39.9062, 116.3913],
            "成都": [30.7637,103.8646],
            "上海": [31.2253,121.4890],
            "深圳": [22.5446,114.0545],
            "广州": [23.1302,113.2593],
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
}

export default GuiHelper;

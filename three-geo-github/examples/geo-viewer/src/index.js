
import env from "./env.js";
import GuiHelper from './gui-helper.js';
import Viewer from './viewer.js';
import jQuery from '../node_modules/jQuery';
import { util } from './util';


import Laser from 'three-laser-pointer/src';


class App extends Threelet {
    // addJson(myDataArray) {
    //     //if(!myDataArray instanceof Array) console.log("?????")
    //     // myDataArray.forEach(data => {
    //         // jQuery.get(myDataArray[0], d => {
    //         //     const mapData = util.decode(d);
    //         //     const map = new ThreeMapLightBar({ mapData });
    //         //     map.on('click', (e, g) => {
    //         //         console.log(g);
    //         //         map.setAreaColor(g);//????
    //         //     });
    //         // })
    //     // });
    //     for(let i=0;i<myDataArray.length-1;i++){
    //         jQuery.get(myDataArray[0], d => {
    //             const mapData = util.decode(d);
    //             mapData.dataExtrude = myDataArray[i+2].extrude;
    //             mapData.layerId=i+1;
    //             mapData.texture=myDataArray[i+2].texture;
    //             mapData.rangeBox=myDataArray[1]
    //             const map = new ThreeMapLightBar({ mapData });
    //             map.on('click', (e, g) => {
    //                 console.log(g);
    //                 map.setAreaColor(g);//????
    //             });
    //         })
    //     }
        

    // }
    getlaser() {

        // Viewer._laserMarker = new Laser({ maxPoints: 2 });
        // Viewer._laserMarker.visible = false;
        // Viewer._laserMarker.name = 'singleton-marker';
        Viewer._laserMarkTmp = new Laser({ maxPoints: 2 });
        Viewer._laserMarkTmp.name = 'singleton-measure-mark-tmp';
        return Viewer._laserMarkTmp
    }

    // override
    onCreate(params) {
        this.camera.position.set(0, 0, 1.5);
        this.camera.up.set(0, 0, 1); // The up vector is along +z for this app

        const stats = this.setup('mod-stats', window.Stats, { panelType: 1 });
        const viewer = new Viewer(env, this);

        this.render = () => { // override
            stats.update();
            this.resizeCanvas();
            viewer.render();
            viewer.showMsg(this.camera);
            viewer.plotCamInMap(this.camera);
        };
        this.setup('mod-controls', THREE.OrbitControls);

        const guiData = App.createGuiData();
        viewer.setGuiHelper(
            App.createGuiHelper(env, guiData, viewer, this.render));

        // viewer.closeGui();
        viewer.toggleMap(guiData.leaflet);
        viewer.showMsg(this.camera);
        viewer.plotCamInMap(this.camera);
        viewer.showMsgTerrain();


        // this.clearLine.click(function(){
        //     this.sceneMeasure.remove(this.sceneMeasure.children[0])
        // })

        this.on('mouse-move', (mx, my) => viewer.pick(mx, my));
        this.on('mouse-click-left', (mx, my) => viewer.updateMeasure(mx, my));
        this.on('mouse-click-right', (mx, my) => viewer.updateOrbit(mx, my));//
        this.on('mouse-click-middle', (mx, my) => viewer.getIntersectMesh(mx, my));//

        this._appData = { stats, viewer, guiData };
    }

    static createGuiData() {
        const query = Viewer.parseQuery();
        return { // with defaults
            vis: query.mode,
            grids: true,
            autoOrbit: false,
            vrLaser: false,
            //----
            loc: query.title ? query.title.replace('_', ' ') : "",
            leaflet: true,
        };
    }
    static createAnimToggler(render) {
        let stopAnim = true;
        const animate = () => {
            if (stopAnim) {
                console.log('animate(): stopping');
                return;
            }
            requestAnimationFrame(animate);
            render();
        };

        return (tf) => {
            if (tf) {
                stopAnim = false;
                animate();
            } else {
                stopAnim = true;
            }
        };
    }
    static createGuiHelper(env, guiData, viewer, render) {
        const animToggler = this.createAnimToggler(render); // a closure
        const guiHelper = new GuiHelper(env, guiData, {
            onCapture: () => {
                viewer.capture();
            },
            onChangeGrids: (value) => {
                viewer.toggleGrids(value);
            },
            onChangeAutoOrbit: (value) => {
                viewer.toggleOrbiting(value);
                if (value) {
                    if (!viewer.hasOrbit()) {
                        viewer.setOrbitDefault();
                    }
                    console.log('starting anim...');
                    animToggler(true);
                } else {
                    console.log('stopping anim...');
                    animToggler(false);
                }
            },
            onChangeVis: (value) => {
                console.log('vis:', value);
                if (value === '等高线') {
                    viewer.loadVectorDem(() => {
                        viewer.updateMode(value);
                        render();
                    });
                } else {
                    viewer.loadRgbDem(() => {
                        viewer.updateMode(value);
                        render();
                    });
                }
            },
            onChangeVrLaser: (value) => {
                viewer.toggleVrLaser(value);
            },
            onChangeLeaflet: (value) => {
                viewer.toggleMap(value);
            },
            onChangeLoc: (value, locations) => {
                if (value === "(none)") { // dummy case
                    return;
                }

                if (value in locations) {
                    let title = value.replace(' ', '_');
                    let ll = locations[value];
                    viewer.reloadPageWithLocation(ll, title);
                }
            },
        });
        guiHelper.setDefaults({
            isDev: () => { },
            vis: guiData.vis,
            capture: () => { },
            grids: guiData.grids,
            //----
            autoOrbit: guiData.autoOrbit,
            vrLaser: guiData.vrLaser,
            reset: () => { },
            //----
            loc: guiData.loc,
            leaflet: guiData.leaflet,
            sourceCode: () => { },
        });
        return guiHelper;
    }

}

const app = new App({
    canvas: document.getElementById("canvas"),

});

app.render(); // first time

window.app = app

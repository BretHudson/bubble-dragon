import {
    AssetManager,
    Game,
    Scene,
    Entity,
    Draw,
} from './canvas-lord/canvas-lord.js';
import { Vec2 } from './canvas-lord/util/math.js';
import { Sprite } from './canvas-lord/util/graphic.js';

const ASSETS = {
    MOLE_SKETCH_PNG: 'mole-sketch.png',
    BG_PNG: 'bg.png',
    BG2_PNG: 'bg2.png',
};

class Background extends Entity {
    constructor(asset_name, canvas_height, assetManager) {
        super(0, 0);
        const asset = assetManager.sprites.get(asset_name);

        this.graphic = new Sprite(asset);
        this.graphic.scale = 0.5;
        this.depth = 1;

        if (asset_name == ASSETS.BG2_PNG) {
            this.graphic.scrollX = 0.5;
            this.depth = 2;
        }

        this.y = canvas_height - asset.height*0.5;
    }

    update(input) {
        const limit = 1000;
        this.x = Math.floor((this.scene.camera.x * this.graphic.scrollX) / limit) * limit;
    }
}

class Mole extends Entity {
    inc = 0; // same as doing `this.inc = 0;` in `constructor(...)`

    constructor(x, y, assetManager) {
        super(x, y);
        const asset = assetManager.sprites.get(
            ASSETS.MOLE_SKETCH_PNG,
        );

        this.graphic = new Sprite(asset);
        this.graphic.centerOrigin();
        this.graphic.scale = 0.25;
    }

    update(input) {
        const speed = 10.0;
        if (input.keyCheck('a')) {
            this.x -= speed;
        } else if (input.keyCheck('d')) {
            this.x += speed;
        }

        if (input.keyCheck('w')) {
            this.y -= speed;

            if (this.y < 150.0) {
                this.y = 150.0;
            } else {
                this.x -= speed*0.5;
            }
        } else if (input.keyCheck('s')) {
            this.y += speed;

            if (this.y > 400.0) {
                this.y = 400.0;
            } else {
                this.x += speed*0.5;
            }
        }
        this.depth = -this.y;

        this.scene.camera.x = this.x - this.scene.engine.canvas.width*0.5;
        if (this.scene.camera.x < 0) {
            this.scene.camera.x = 0;
        }

        // this.graphic.angle = Math.sin(this.inc++ / 30) * 20;
    }
}

class Grimey extends Entity {
    constructor(x, y, assetManager) {
        super(x, y);
        const asset = assetManager.sprites.get(
            ASSETS.MOLE_SKETCH_PNG,
        );

        this.graphic = new Sprite(asset);
        this.graphic.centerOrigin();
        this.graphic.scale = 0.25;
    }

    update(input) {
        this.depth = -this.y;
    }
}

let game;
const assetManager = new AssetManager('./img/');
Object.values(ASSETS).forEach((asset) => {
        switch (true) {
            case asset.endsWith('.png'):
            assetManager.addImage(asset);
            break;
            case asset.endsWith('.mp3'):
            assetManager.addAudio(asset);
            break;
        }
    });
assetManager.onLoad(() => {
        if (game) return;

        game = new Game('ggj-2025-game', {
                fps: 60,
                gameLoopSettings: {
                    updateMode: 'always', // or set it to 'focus'
                    renderMode: 'onUpdate',
                },
            });
        game.assetManager = assetManager;
        game.backgroundColor = '#6c6d71';

        const scene = new Scene(game);

        const canvasSize = new Vec2(
            game.canvas.width,
            game.canvas.height,
        );
        const canvasCenter = canvasSize.scale(0.5);

        const mole = new Mole(
            canvasCenter.x,
            canvasCenter.y,
            assetManager,
        );

        const bg2 = new Background(ASSETS.BG2_PNG, canvasSize.y, assetManager);
        const bg = new Background(ASSETS.BG_PNG, canvasSize.y, assetManager);
        [bg, bg2, mole].forEach((e) => {
                scene.addEntity(e);
                scene.addRenderable(e);
            });

        for (var i = 0; i < 15; i++) {
            const e = new Grimey(
                Math.random() * 8000.0,
                game.canvas.height - (Math.random() * 200.0),
                assetManager,
            );

            scene.addEntity(e);
            scene.addRenderable(e);
        }

        game.pushScene(scene);
        game.render();
    });
assetManager.loadAssets();

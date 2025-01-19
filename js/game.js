import {
    AssetManager,
    Game,
    Scene,
    Entity,
    Draw,
} from './canvas-lord/canvas-lord.js';
import { Vec2 } from './canvas-lord/util/math.js';

const ASSETS = {
    MOLE_SKETCH_PNG: 'mole-sketch.png',
};

var TheMap;

class Char extends Entity {
    vx = 0.0;
    vy = 0.0;
    angle = 0.0;
    on_ground = false;
    flip = false;

    collide(nx, ny) {
        var min_x = Math.floor((nx - 30.0) / 40.0);
        var min_y = Math.floor((ny - 60.0) / 40.0);
        var max_x = Math.floor((nx + 30.0) / 40.0);
        var max_y = Math.floor((ny) / 40.0);

        if (min_x < 0 || max_x >= TheMap.heights.length) {
            return true;
        }

        for (var y = min_y; y <= max_y; y++) {
            for (var x = min_x; x <= max_x; x++) {
                var floor_y = TheMap.heights[x];
                if (y == TheMap.bottom || y == floor_y) {
                    return true;
                }
            }
        }

        return false;
    }

    update(input) {
        var friction = (this.on_ground ? 5.0 : 1.5) / 30.0;

        var nx = this.x + this.vx*(1.0/60.0);
        var ny = this.y + this.vy*(1.0/60.0);
        if (!this.collide(nx, this.y)) {
            this.x = nx;
        } else {
            this.vx = 0.0;
        }

        this.on_ground = false;
        if (!this.collide(this.x, ny)) {
            this.y = ny;
        } else if (this.vy >= 0.0) {
            this.vy = 0.0;
            this.on_ground = true;
        }

        this.vx -= this.vx*friction;
        if (!this.on_ground) {
            this.vy += 10.0;
        }

        var target_angle = Math.max(Math.min(-(this.vy * 0.06), 15.0), -15.0);
        this.angle = this.angle+((target_angle - this.angle)*0.3);
    }

    render(ctx) {
        const { width, height } = this.sprite.image;

        const scale = 60.0 / width;
        const originX = -width >> 1;
        const originY = -height;
        const shared = {
            angle: this.angle,
            scaleX: this.flip ? -scale : scale,
            scaleY: scale,
            originX, // same as doing `originX: originX,`
            originY,
            offsetX: originX,
            offsetY: originY,
        };

        const imageOptions = {
            imageSrc: this.sprite.image,
            ...shared,
        };
        Draw.image(ctx, imageOptions, this.x, this.y);

        var min_x = Math.floor((this.x - 30.0) / 40.0);
        var min_y = Math.floor((this.y - 60.0) / 40.0);
        var max_x = Math.floor((this.x + 30.0) / 40.0);
        var max_y = Math.floor((this.y) / 40.0);
        const rectOptions = {
            type: 'stroke',
            color: 'blue',
            angle: 0.0,
            scaleX: 1.0,
            scaleY: 1.0,
            originX: 0.0,
            originY: 0.0,
            offsetX: 0.0,
            offsetY: 0.0,
        };

        for (var y = min_y; y <= max_y; y++) {
            for (var x = min_x; x <= max_x; x++) {
                var floor_y = TheMap.heights[x];
                rectOptions.color = (y == TheMap.bottom || y == floor_y) ? 'red' : 'blue';

                Draw.rect(ctx, rectOptions, x*40.0, y*40.0, 40.0, 40.0);
            }
        }
    }
}

class Mole extends Char {
    constructor(x, y, assetManager) {
        super(x, y);
        this.sprite = assetManager.sprites.get(
            ASSETS.MOLE_SKETCH_PNG,
        );
    }

    update(input) {
        var speed = this.on_ground ? 30 : 10;
        if (input.keyCheck('a')) {
            this.vx -= speed;
            if (this.on_ground) { this.flip = false; }
        } else if (input.keyCheck('d')) {
            this.vx += speed;
            if (this.on_ground) { this.flip = true; }
        }

        super.update(input);

        if (this.on_ground && input.keyCheck(' ')) {
            this.vy = -250.0;
        }
    }
}

class Farmer extends Char {
    constructor(x, y, assetManager) {
        super(x, y);
        this.sprite = assetManager.sprites.get(
            ASSETS.MOLE_SKETCH_PNG,
        );
    }

    update(input) {
        var speed = this.on_ground ? 30 : 10;

        var min_dist = 1000.0;
        var min_radish = null;

        const n = this.scene.renderables.inScene.length;
        for (var i = 0; i < n; ++i) {
            const e = this.scene.renderables.inScene[i];
            if (e instanceof Radish) {
                var dist = Math.abs(e.x - this.x);
                if (dist < min_dist) {
                    min_dist = dist;
                    min_radish = e;
                }
            }
        }

        if (min_radish) {
            if (min_dist >= 20.0) {
                if (min_radish.x > this.x) {
                    this.vx += speed;
                } else if (min_radish.x < this.x) {
                    this.vx -= speed;
                }
            } else {
                var xx = min_radish.x - this.x;
                var yy = min_radish.y - this.y;
                if (xx*xx + yy*yy < 30.0*30.0) {
                    this.scene.removeRenderable(min_radish);
                }
            }

            // farmer is always jumping around
            if (this.on_ground) {
                this.vy = -250.0;
            }
        }
        // this.vx += this.flip ? speed : -speed;

        super.update(input);
    }
}

class Radish extends Entity {
    constructor(x, y, assetManager) {
        super(x, y);
        this.sprite = assetManager.sprites.get(
            ASSETS.MOLE_SKETCH_PNG,
        );
    }

    render(ctx) {
        const { width, height } = this.sprite.image;

        const scale = 40.0 / width;
        const originX = 0.0;
        const originY = 0.0;
        const shared = {
            angle: this.angle,
            scaleX: this.flip ? -scale : scale,
            scaleY: scale,
            originX, // same as doing `originX: originX,`
            originY,
            offsetX: originX,
            offsetY: originY,
        };

        const imageOptions = {
            imageSrc: this.sprite.image,
            ...shared,
        };
        Draw.image(ctx, imageOptions, this.x, this.y);
    }
}

class Tilemap extends Entity {
    bottom = 0.0;
    heights = [];

    constructor(bot, assetManager) {
        super(0.0, 0.0);
        this.bottom = Math.floor(bot / 40.0);

        for (var x = 0; x < 30; x++) {
            var y = 0.0;

            var amp = 1.0;
            var freq = 0.3;
            for (var i = 1; i <= 4; i++) {
                y += Math.sin(x * freq) * amp;
                freq *= 2.0;
                amp *= 0.5;
            }

            this.heights.push(this.bottom - (Math.floor(y) + 8));
        }
    }

    render(ctx) {
        const rectOptions = {
            type: 'fill',
            color: 'red',
            angle: this.angle,
            scaleX: 1.0,
            scaleY: 1.0,
            originX: 0.0, // same as doing `originX: originX,`
            originY: 0.0,
            offsetX: 0.0,
            offsetY: 0.0,
        };

        for (var x = 0; x < 30; x++) {
            Draw.rect(ctx, rectOptions, x*40.0, this.heights[x]*40.0, 38.0, 40.0);
        }
    }
}

let game;
const assetManager = new AssetManager('./img/');
assetManager.addImage(ASSETS.MOLE_SKETCH_PNG);
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

        var mole = new Mole(
            canvasCenter.x,
            canvasCenter.y + 100.0,
            assetManager,
        );

        var farmer = new Farmer(
            canvasCenter.x,
            canvasCenter.y - 100.0,
            assetManager,
        );

        TheMap = new Tilemap(game.canvas.height, assetManager);

        scene.addRenderable(TheMap);

        scene.addEntity(mole);
        scene.addRenderable(mole);

        scene.addEntity(farmer);
        scene.addRenderable(farmer);

        for (var i = 0; i < 7; i++) {
            var x = 1+(i*3);
            scene.addRenderable(new Radish(x*40.0, (TheMap.heights[x]-0.5)*40.0, assetManager));
        }

        game.pushScene(scene);

        game.render();
    });
assetManager.loadAssets();

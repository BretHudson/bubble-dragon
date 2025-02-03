import { Entity, Keys, Scene } from '../canvas-lord/canvas-lord.js';
import { Sprite, Text, GraphicList } from '../canvas-lord/graphic/index.js';
import { DEPTH, assetManager, settings } from '../assets.js';

const continueKeys = [Keys.Space, Keys.Enter, Keys.Z, Keys.X];
let screen_min, screen_max;
export class OverlayEntity extends Entity {
	fade = 0.0;
	spawnBoss = false;

	constructor(txt, w, h, spawnBoss, entities) {
		super(w / 2, h / 2);
		this.spawnBoss = spawnBoss;
		this.entities = entities;

		this.graphic = new GraphicList();

		this.bg = Sprite.createRect(w, h, 'black');
		this.bg.centerOrigin();
		this.bg.scrollX = 0.0;
		this.graphic.add(this.bg);

		this.txt = new Text(txt, 0, 0, {
			font: 'Skullboy',
			size: 32,
		});
		this.txt.scrollX = 0.0;
		this.txt.centerOrigin();
		this.graphic.add(this.txt);
		this.depth = DEPTH.OVERLAY;
	}

	update(input) {
		this.fade += 1.0 / 60.0;
		if (this.fade > 1.0) {
			this.fade = 1.0;

			if (this.spawnBoss) {
				screen_min = this.scene.room_start;
				screen_max = this.scene.room_start + 400.0;

				const { Boss, Grimey } = this.entities;

				const e = new Boss(
					this.scene.room_start +
						this.scene.engine.canvas.width * 0.5,
					this.scene.engine.canvas.height * 0.5,
					assetManager,
				);
				this.scene.addEntity(e);
				this.scene.addRenderable(e);

				const n = this.scene.entities.inScene.length;
				for (let i = 0; i < n; ++i) {
					const e = this.scene.entities.inScene[i];
					if (e instanceof Grimey) {
						this.scene.removeRenderable(e);
						this.scene.removeEntity(e);
						e.scene = null;
					}
				}

				// kill overlay
				this.scene.removeRenderable(this);
				this.scene.removeEntity(this);
				this.scene = null;
			} else {
				if (input.keyPressed(continueKeys)) {
					this.scene.engine.popScenes();
					this.scene.engine.popScenes();
				}
			}
		}

		this.bg.alpha = this.spawnBoss
			? Math.sin(this.fade * Math.PI) * 0.5 + 0.5
			: this.fade;

		this.visible = !settings.hideOverlay;
	}
}

export class ResultsScene extends Scene {
	constructor(engine, txt) {
		super(engine);

		const w = engine.canvas.width;
		const h = engine.canvas.height;

		this.bg = Sprite.createRect(w, h, 'black');
		this.bg.centerOrigin();
		this.addGraphic(this.bg);

		this.camera.setXY(-w >> 1, -h >> 1);

		this.txt = new Text(txt, 0, 0, {
			font: 'Skullboy',
			size: 32,
		});
		this.txt.centerOrigin();
		this.addGraphic(this.txt);

		this.bg.alpha = 0;
	}

	addGraphic(gfx) {
		const e = new Entity();
		e.graphic = gfx;
		this.addEntity(e);
		this.addRenderable(e);
	}

	update(input) {
		this.bg.alpha += 0.01;

		if (this.bg.alpha >= 1) {
			if (input.keyPressed(continueKeys)) {
				this.engine.popScenes();
				this.engine.popScenes();
			}
			this.bg.alpha = 1;
		}
	}
}

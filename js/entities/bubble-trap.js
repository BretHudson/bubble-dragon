import {
	AssetManager,
	Sfx,
	Game,
	Scene,
	Entity,
	Draw,
	Tileset,
} from '../canvas-lord/canvas-lord.js';
import { BoxCollider } from '../canvas-lord/collider/index.js';
import { Keys } from '../canvas-lord/core/input.js';
import {
	Text,
	Sprite,
	AnimatedSprite,
	GraphicList,
} from '../canvas-lord/graphic/index.js';
import { Vec2 } from '../canvas-lord/math/index.js';
import { Random } from '../canvas-lord/util/random.js';
import { initDebug } from '../debug.js';
import { Menu, MenuOptions } from '../menu.js';
import { assetManager, ASSETS, DEPTH, COLLISION_TAG, punch_sfx, settings } from '../assets.js';
import { Character } from './character.js';

export class BubbleTrap extends Entity {
	t = 0.0;
	dir = 0.0;
	baseline = 0.0;

	constructor(x, y, dir, assetManager) {
		super(x, y);

		this.graphic = new Sprite(
			assetManager.sprites.get(ASSETS.BUBBLES2_PNG),
		);
		this.assetManager = assetManager;
		this.graphic.centerOrigin();
		this.graphic.scale = 2.0;
		this.baseline = y;
		this.dir = dir;
		this.depth = -y;
		// TODO(bret): CircleCollider?
		// yes i moved it slightly down on purpose
		this.collider = new BoxCollider(40, 40, -20, -20);
		this.collider.tag = COLLISION_TAG.BUBBLE;
	}

	update(input) {
		this.t += 10.0 / 60.0;

		this.x += this.dir * 1.5;
		this.graphic.y = Math.sin(this.t * 0.5) * 8.0 - 50.0;

		let view_x = this.x - this.scene.camera.x;
		if (view_x < 0.0 || view_x >= this.scene.engine.canvas.width) {
			if (this.caught) {
				this.caught.bubble = null;
				this.caught.graphic.y = -80.0;
				this.caught.graphic.scale = 1.0;
			}

			Sfx.play(this.assetManager.audio.get(ASSETS.POP));

			this.scene.removeRenderable(this);
			this.scene.removeEntity(this);
			this.scene = null;
			return;
		}

		if (!this.caught) {
			// if an enemy gets caught by a bubble we wanna drag them with it
			const e = this.collideEntity(this.x, this.y, [COLLISION_TAG.CHAR]);
			if (e !== null && e !== this.owner && !e.bubble) {
				// if (e instanceof Boss) {
				if (e.constructor.name === 'Boss') {
					e.animState = -1;
					e.dx = 20.0 * this.dir;
					e.hurt(1);
					e.graphic.play('stunned');
					this.caught = e;

					Sfx.play(this.assetManager.audio.get(ASSETS.POP));
					this.scene.removeRenderable(this);
					this.scene.removeEntity(this);
					this.scene = null;
				// } else if (e instanceof Grimey) {
				} else if (e.constructor.name === 'Grimey') {
					e.bubble = this;
					e.hurt(1);
					e.animState = -1;
					e.graphic.scale = 0.4;
					e.graphic.play('stuck');
					this.caught = e;
				}
			}
		}
	}
}
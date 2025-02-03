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

const random = new Random();

export class Hitbox extends Entity {
	time = 0;
	owner = null;
	dmg = 0;
	dir = 0;

	constructor(o, d, x, y, dir) {
		super(x, y);
		this.dir = dir;
		this.dmg = d;
		this.owner = o;
		this.collider = new BoxCollider(20, 60, 0, -30);
		this.collider.tag = COLLISION_TAG.HITBOX;
		this.hasCollided = false;
	}

	update(input) {
		this.collider.collidable = this.owner.graphic.frameId === 5;
		
		if (this.collider.collidable) {
			this.hasCollided = true;
			
			const ents = this.collideEntities(this.x, this.y, [
				COLLISION_TAG.CHAR,
			]);
			ents.forEach((e) => {
				if (e !== null && e !== this.owner && e instanceof Character) {
					if (e.hurt(this.dmg)) {
						if (e.health === 0) {
							e.dx = 30.0 * this.dir;
							e.friction = 0.2;
						}

						const asset = assetManager.audio.get(
							random.choose(punch_sfx),
						);
						Sfx.play(asset);
					}
				}
			});
		} else if (this.hasCollided) {
			if (this.owner.hitbox === this)
				this.owner.hitbox = null;
			this.scene.removeEntity(this);
			this.scene.removeRenderable(this);
		}
	}
}
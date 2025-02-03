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
import {
	assetManager,
	ASSETS,
	DEPTH,
	COLLISION_TAG,
	punch_sfx,
	settings,
} from '../assets.js';

const invincibilityDuration = 30;
export class Character extends Entity {
	invFrames = 0;
	health = 10;

	animState = 0;
	hitbox = null;

	dx = 0;
	dy = 0;

	flipOffset = 0;
	friction = 0.5;

	constructor(
		x,
		y,
		{
			health,
			asset,
			spriteW,
			spriteH,
			width,
			height,
			tag,
			flipOffset,
			points,
			enemyDirector,
		},
	) {
		super(x, y);

		this.points = points;

		this.maxHealth = health;
		this.health = this.maxHealth;

		this.enemyDirector = enemyDirector;
		this.enemyDirector.register(this);

		if (width && height) {
			// TODO(bret): CircleCollider? (or maybe Ellipsis??)
			this.collider = new BoxCollider(
				width,
				height,
				-width * 0.5,
				-height * 0.5 - 10,
			);
			this.collider.tag = tag ?? COLLISION_TAG.CHAR;
		}

		if (asset) {
			this.graphic = new AnimatedSprite(asset, spriteW, spriteH);
			this.graphic.centerOO();
			this.graphic.originY = 0;
			this.graphic.offsetY = 0;
			this.graphic.y = -this.graphic.frameH;
		}

		this.flipOffset = flipOffset;
	}

	get isDead() {
		return this.health <= 0;
	}

	updateGraphic() {
		this.graphic.scaleX = this.flip ? -1.0 : 1.0;
		this.graphic.x = this.flip ? -this.flipOffset : this.flipOffset;
	}

	onDeath() {
		this.scene.removeRenderable(this);
		this.scene.removeEntity(this);
		this.scene = null;

		this.enemyDirector.unregister(this);
	}

	hurt(pts) {
		if (this.invFrames > 0) {
			return false;
		}

		if (this.health <= pts) {
			this.health = 0;
			this.onDeath();
		} else {
			this.health -= pts;
		}
		this.invFrames = invincibilityDuration;
		this.updateHitFlash();
		return true;
	}

	updateHitFlash() {
		if (this.health <= 0) {
			this.hitFlash = false;
			return;
		}
		this.hitFlash = this.invFrames && this.invFrames % 16 >= 8;
	}

	update(input) {
		super.update(input);

		if (this.scene === null) {
			return; // we just died
		}

		// friction
		this.dx -= this.dx * this.friction;
		this.dy -= this.dy * this.friction;

		if (this.ignoreCollisions) {
			this.x += this.dx;
			this.y += this.dy;
		} else {
			this.x += this.collide(this.x + this.dx, this.y, COLLISION_TAG.CHAR)
				? 0.0
				: this.dx;
			this.y += this.collide(this.x, this.y + this.dy, COLLISION_TAG.CHAR)
				? 0.0
				: this.dy;
		}
		// TODO(bret): Uncomment this :)
		// this.x = Math.clamp(this.x, screen_min - 100.0, screen_max + 20.0);
		// this.y = Math.clamp(this.y, minY, maxY);

		this.depth = -this.y;
		this.updateGraphic();

		if (this.invFrames > 0) {
			this.invFrames -= 1;
		}

		this.updateHitFlash();
	}

	render(ctx, camera) {
		const drawX = this.x - camera.x;
		const drawY = this.y - camera.y;

		const r = 9;
		const circleOptions = {
			type: 'fill',
			color: '#00000033',
			radius: r,
			scaleX: 2,
		};
		Draw.circle(ctx, circleOptions, drawX - r * 2, drawY - r, r);
		Draw.circle(
			ctx,
			{
				...circleOptions,
				color: '#ffffff22',
				type: 'stroke',
			},
			drawX - r * 2,
			drawY - r,
			r,
		);

		this.graphic.color = this.hitFlash ? 'white' : undefined;
		super.render(ctx, camera);
	}
}

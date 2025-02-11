/* Canvas Lord v0.5.1 */
import { Graphic } from './graphic.js';
import { Vec2 } from '../math/index.js';
import { Draw } from '../util/draw.js';
// TODO(bret): How to tile?
export class Sprite extends Graphic {
    asset;
    sourceX = 0;
    sourceY = 0;
    sourceW;
    sourceH;
    color;
    blend;
    get width() {
        return this.imageSrc.width;
    }
    get w() {
        return this.width;
    }
    get height() {
        return this.imageSrc.height;
    }
    get h() {
        return this.height;
    }
    get imageSrc() {
        if (!this.asset.image)
            throw new Error("asset.image hasn't loaded yet");
        return this.asset.image;
    }
    constructor(asset, x = 0, y = 0, sourceX = 0, sourceY = 0, sourceW = undefined, sourceH = undefined) {
        super(x, y);
        this.asset = asset;
        this.sourceX = sourceX;
        this.sourceY = sourceY;
        this.sourceW = sourceW;
        this.sourceH = sourceH;
    }
    static createRect(width, height, color) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            throw new Error('[Sprite.createRect()] getContext() failed');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const asset = {
            // TODO(bret): Could hash these & put them in assetManager :O
            fileName: [width, height, color].join('-'),
            image: null,
            loaded: false,
        };
        const img = new Image(width, height);
        img.onload = () => {
            if ((asset.image = img)) {
                asset.width = width;
                asset.height = height;
                asset.loaded = true;
            }
        };
        img.src = canvas.toDataURL();
        // TODO(bret): This might be dangerous!! It unfortunately is needed for new Sprite() to work :/
        asset.loaded = true;
        asset.image = img;
        return new Sprite(asset);
    }
    centerOrigin() {
        this.offsetX = -this.width >> 1;
        this.offsetY = -this.height >> 1;
        this.originX = -this.width >> 1;
        this.originY = -this.height >> 1;
    }
    render(ctx, camera = Vec2.zero) {
        const { sourceX, sourceY, sourceW = this.width, sourceH = this.height, } = this;
        const x = this.x - camera.x * this.scrollX + (this.parent?.x ?? 0);
        const y = this.y - camera.y * this.scrollY + (this.parent?.y ?? 0);
        Draw.image(ctx, this, x, y, sourceX, sourceY, sourceW, sourceH);
    }
    reset() {
        super.reset();
        this.sourceX = 0;
        this.sourceY = 0;
        this.sourceW = undefined;
        this.sourceH = undefined;
        this.color = undefined;
        this.blend = undefined;
    }
}
//# sourceMappingURL=sprite.js.map
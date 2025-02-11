/* Canvas Lord v0.5.1 */
import { Draw } from './draw.js';
import { image } from './components.js';
import * as Components from './components.js';
export const imageSystem = {
    render(entity, ctx, camera) {
        const _image = entity.component?.(image);
        if (!_image)
            return;
        // TODO(bret): Remove the ignore!
        // @ts-ignore
        const drawX = entity.x - camera.x - _image.offsetX;
        // TODO(bret): Remove the ignore!
        // @ts-ignore
        const drawY = entity.y - camera.y - _image.offsetY;
        const sourceX = _image.frame * _image.frameW;
        Draw.image(ctx, _image, drawX, drawY, sourceX, 0, _image.frameW, _image.frameH);
    },
};
export const rectSystem = {
    update(entity) {
        const _rect = entity.component?.(Components.rect);
        if (!_rect)
            return;
        // TODO(bret): Remove the ignore!
        // @ts-ignore
        _rect.angle += 2;
    },
    render(entity, ctx, camera) {
        const _rect = entity.component?.(Components.rect);
        if (!_rect)
            return;
        Draw.rect(ctx, _rect, 
        // TODO(bret): Remove the ignore!
        // @ts-ignore
        entity.x - camera.x - _rect.offsetX, 
        // TODO(bret): Remove the ignore!
        // @ts-ignore
        entity.y - camera.y - _rect.offsetY, _rect.width, _rect.height);
    },
};
export const circleSystem = {
    render(entity, ctx, camera) {
        const _circle = entity.component?.(Components.circle);
        if (!_circle)
            return;
        Draw.circle(ctx, _circle, 
        // TODO(bret): Remove the ignore!
        // @ts-ignore
        entity.x - camera.x - _circle.offsetX, 
        // TODO(bret): Remove the ignore!
        // @ts-ignore
        entity.y - camera.y - _circle.offsetY, _circle.radius || 5);
    },
};
export const moveEightSystem = {
    update: (entity) => {
        const move8Comp = entity.component?.(Components.moveEightComponent);
        if (!move8Comp)
            return;
        const { originX, originY, dt } = move8Comp;
        entity.x = originX + Math.cos(dt / 16) * 16;
        entity.y = originY + Math.sin(dt / 8) * 8;
        ++move8Comp.dt;
    },
};
//# sourceMappingURL=systems.js.map
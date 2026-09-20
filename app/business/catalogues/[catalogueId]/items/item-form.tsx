"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, FormInput } from "@/components/ui";

type Photo = { path: string; url: string };

type Initial = {
  productName: string;
  sku: string;
  description: string;
  price: string;
  moq: string;
  category: string;
  photos: Photo[];
};

const labelClass = "flex flex-col gap-1";
const textareaClass =
  "font-ds-sans bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md py-ds-sm outline-none focus:border-ds-hairline-tertiary";
const hintClass = "text-ds-caption text-ds-mute";

export function ItemForm({
  action,
  catalogueId,
  itemId,
  initial,
}: {
  action: (formData: FormData) => void;
  catalogueId: string;
  itemId?: string;
  initial: Initial;
}) {
  const [photosToRemove, setPhotosToRemove] = useState<Set<string>>(new Set());

  function toggleRemove(path: string) {
    setPhotosToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="catalogue_id" value={catalogueId} />
      {itemId && <input type="hidden" name="item_id" value={itemId} />}

      <label className={labelClass}>
        <span className="text-ds-caption text-ds-mute">Product name</span>
        <FormInput type="text" name="product_name" defaultValue={initial.productName} required />
      </label>

      <div className="flex gap-4">
        <label className={labelClass + " flex-1"}>
          <span className="text-ds-caption text-ds-mute">SKU</span>
          <FormInput type="text" name="sku" defaultValue={initial.sku} />
        </label>
        <label className={labelClass + " flex-1"}>
          <span className="text-ds-caption text-ds-mute">Category</span>
          <FormInput type="text" name="category" defaultValue={initial.category} />
        </label>
      </div>

      <label className={labelClass}>
        <span className="text-ds-caption text-ds-mute">Description</span>
        <textarea name="description" defaultValue={initial.description} rows={3} className={textareaClass} />
      </label>

      <div className="flex gap-4">
        <label className={labelClass + " flex-1"}>
          <span className="text-ds-caption text-ds-mute">Price (R)</span>
          <FormInput type="number" min={0} step="0.01" name="price" defaultValue={initial.price} />
        </label>
        <label className={labelClass + " flex-1"}>
          <span className="text-ds-caption text-ds-mute">MOQ</span>
          <FormInput type="number" min={0} name="moq" defaultValue={initial.moq} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-ds-caption text-ds-mute">Photos</legend>

        {initial.photos.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {initial.photos.map((photo) => (
              <label key={photo.path} className="flex flex-col items-center gap-1 text-ds-caption">
                <div className="relative h-16 w-full overflow-hidden rounded-ds-sm">
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    sizes="80px"
                    className={"object-cover " + (photosToRemove.has(photo.path) ? "opacity-40" : "")}
                  />
                </div>
                <span className="flex items-center gap-1 text-ds-mute">
                  <input
                    type="checkbox"
                    name="remove_photos"
                    value={photo.path}
                    checked={photosToRemove.has(photo.path)}
                    onChange={() => toggleRemove(photo.path)}
                  />
                  Remove
                </span>
              </label>
            ))}
          </div>
        )}

        <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple />
        <span className={hintClass}>Up to 4 photos total, 5MB each (JPEG, PNG, WebP).</span>
      </fieldset>

      <Button type="submit" variant="primary" className="w-fit">
        Save item
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";

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

const inputClass = "rounded px-3 py-2 text-navy-900";
const labelClass = "flex flex-col gap-1";
const hintClass = "text-xs text-navy-200";

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
        <span className="text-sm text-navy-100">Product name</span>
        <input type="text" name="product_name" defaultValue={initial.productName} required className={inputClass} />
      </label>

      <div className="flex gap-4">
        <label className={labelClass + " flex-1"}>
          <span className="text-sm text-navy-100">SKU</span>
          <input type="text" name="sku" defaultValue={initial.sku} className={inputClass} />
        </label>
        <label className={labelClass + " flex-1"}>
          <span className="text-sm text-navy-100">Category</span>
          <input type="text" name="category" defaultValue={initial.category} className={inputClass} />
        </label>
      </div>

      <label className={labelClass}>
        <span className="text-sm text-navy-100">Description</span>
        <textarea name="description" defaultValue={initial.description} rows={3} className={inputClass} />
      </label>

      <div className="flex gap-4">
        <label className={labelClass + " flex-1"}>
          <span className="text-sm text-navy-100">Price (R)</span>
          <input type="number" min={0} step="0.01" name="price" defaultValue={initial.price} className={inputClass} />
        </label>
        <label className={labelClass + " flex-1"}>
          <span className="text-sm text-navy-100">MOQ</span>
          <input type="number" min={0} name="moq" defaultValue={initial.moq} className={inputClass} />
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm text-navy-100">Photos</legend>

        {initial.photos.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {initial.photos.map((photo) => (
              <label key={photo.path} className="flex flex-col items-center gap-1 text-xs">
                <div className="relative h-16 w-full overflow-hidden rounded">
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    sizes="80px"
                    className={"object-cover " + (photosToRemove.has(photo.path) ? "opacity-40" : "")}
                  />
                </div>
                <span className="flex items-center gap-1">
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

      <button
        type="submit"
        className="w-fit rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
      >
        Save item
      </button>
    </form>
  );
}

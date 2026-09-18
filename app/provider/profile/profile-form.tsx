"use client";

import { useState } from "react";
import Image from "next/image";

type Photo = { path: string; url: string };

type Initial = {
  category: "rep" | "printer";
  name: string;
  bio: string;
  province: string;
  town: string;
  photos: Photo[];
  rep?: {
    industries: string;
    regionsCovered: string;
    yearsExperience: string;
    languages: string;
  };
  printer?: {
    printTypes: string;
    turnaroundDays: string;
    equipment: string;
    maxPrintSize: string;
  };
};

const inputClass = "rounded px-3 py-2 text-navy-900";
const labelClass = "flex flex-col gap-1";
const hintClass = "text-xs text-navy-200";

export function ProviderProfileForm({
  action,
  initial,
}: {
  action: (formData: FormData) => void;
  initial: Initial;
}) {
  const [category, setCategory] = useState<"rep" | "printer">(initial.category);
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
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-navy-100">Category</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="category"
            value="rep"
            checked={category === "rep"}
            onChange={() => setCategory("rep")}
          />
          Sales rep
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="category"
            value="printer"
            checked={category === "printer"}
            onChange={() => setCategory("printer")}
          />
          Poster/signage printer
        </label>
      </fieldset>

      <label className={labelClass}>
        <span className="text-sm text-navy-100">Name</span>
        <input type="text" name="name" defaultValue={initial.name} required className={inputClass} />
      </label>

      <label className={labelClass}>
        <span className="text-sm text-navy-100">Bio</span>
        <textarea name="bio" defaultValue={initial.bio} rows={4} className={inputClass} />
      </label>

      <div className="flex gap-4">
        <label className={labelClass + " flex-1"}>
          <span className="text-sm text-navy-100">Province</span>
          <input type="text" name="province" defaultValue={initial.province} className={inputClass} />
        </label>
        <label className={labelClass + " flex-1"}>
          <span className="text-sm text-navy-100">Town</span>
          <input type="text" name="town" defaultValue={initial.town} className={inputClass} />
        </label>
      </div>

      {category === "rep" ? (
        <fieldset className="flex flex-col gap-3 rounded border border-navy-500 p-4">
          <legend className="px-1 text-sm text-navy-100">Sales rep details</legend>
          <label className={labelClass}>
            <span className="text-sm text-navy-100">Industries</span>
            <input
              type="text"
              name="industries"
              defaultValue={initial.rep?.industries}
              className={inputClass}
              placeholder="FMCG, hospitality, retail"
            />
            <span className={hintClass}>Comma separated</span>
          </label>
          <label className={labelClass}>
            <span className="text-sm text-navy-100">Regions covered</span>
            <input
              type="text"
              name="regions_covered"
              defaultValue={initial.rep?.regionsCovered}
              className={inputClass}
              placeholder="Gauteng, Western Cape"
            />
            <span className={hintClass}>Comma separated</span>
          </label>
          <label className={labelClass}>
            <span className="text-sm text-navy-100">Years of experience</span>
            <input
              type="number"
              min={0}
              name="years_experience"
              defaultValue={initial.rep?.yearsExperience}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span className="text-sm text-navy-100">Languages</span>
            <input
              type="text"
              name="languages"
              defaultValue={initial.rep?.languages}
              className={inputClass}
              placeholder="English, isiZulu"
            />
            <span className={hintClass}>Comma separated</span>
          </label>
        </fieldset>
      ) : (
        <fieldset className="flex flex-col gap-3 rounded border border-navy-500 p-4">
          <legend className="px-1 text-sm text-navy-100">Printer details</legend>
          <label className={labelClass}>
            <span className="text-sm text-navy-100">Print types</span>
            <input
              type="text"
              name="print_types"
              defaultValue={initial.printer?.printTypes}
              className={inputClass}
              placeholder="Posters, banners, vehicle signage"
            />
            <span className={hintClass}>Comma separated</span>
          </label>
          <label className={labelClass}>
            <span className="text-sm text-navy-100">Turnaround (days)</span>
            <input
              type="number"
              min={0}
              name="turnaround_days"
              defaultValue={initial.printer?.turnaroundDays}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span className="text-sm text-navy-100">Equipment</span>
            <input
              type="text"
              name="equipment"
              defaultValue={initial.printer?.equipment}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            <span className="text-sm text-navy-100">Max print size</span>
            <input
              type="text"
              name="max_print_size"
              defaultValue={initial.printer?.maxPrintSize}
              className={inputClass}
            />
          </label>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm text-navy-100">Photos</legend>

        {initial.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {initial.photos.map((photo) => (
              <label key={photo.path} className="flex flex-col items-center gap-1 text-xs">
                <div className="relative h-20 w-full overflow-hidden rounded">
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    sizes="120px"
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
        <span className={hintClass}>Up to 8 photos total, 5MB each (JPEG, PNG, WebP).</span>
      </fieldset>

      <button
        type="submit"
        className="rounded bg-teal-500 px-4 py-2 font-semibold text-white hover:bg-teal-600"
      >
        Save profile
      </button>
    </form>
  );
}

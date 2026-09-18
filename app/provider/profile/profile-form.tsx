"use client";

import { useState } from "react";
import Image from "next/image";

type Photo = { path: string; url: string };

type Initial = {
  category: "rep" | "printer" | "distributor";
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
  distributor?: {
    productCategoriesSought: string;
    coverageMethod: "town_list" | "radius";
    coveredTowns: string;
    hubTown: string;
    radiusKm: string;
    coverageScope: string;
    minOrderQty: string;
    portfolioGapNotes: string;
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
  const [category, setCategory] = useState<"rep" | "printer" | "distributor">(initial.category);
  const [coverageMethod, setCoverageMethod] = useState<"town_list" | "radius">(
    initial.distributor?.coverageMethod ?? "town_list",
  );
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
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="category"
            value="distributor"
            checked={category === "distributor"}
            onChange={() => setCategory("distributor")}
          />
          Distributor
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

      {category === "rep" && (
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
      )}

      {category === "printer" && (
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

      {category === "distributor" && (
        <fieldset className="flex flex-col gap-3 rounded border border-navy-500 p-4">
          <legend className="px-1 text-sm text-navy-100">Distributor details</legend>
          <label className={labelClass}>
            <span className="text-sm text-navy-100">Product categories sought</span>
            <input
              type="text"
              name="product_categories_sought"
              defaultValue={initial.distributor?.productCategoriesSought}
              className={inputClass}
              placeholder="FMCG, beverages, household goods"
            />
            <span className={hintClass}>Comma separated</span>
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm text-navy-100">Coverage</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="coverage_method"
                value="town_list"
                checked={coverageMethod === "town_list"}
                onChange={() => setCoverageMethod("town_list")}
              />
              List of towns
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="coverage_method"
                value="radius"
                checked={coverageMethod === "radius"}
                onChange={() => setCoverageMethod("radius")}
              />
              Hub town + radius
            </label>
          </fieldset>

          {coverageMethod === "town_list" ? (
            <label className={labelClass}>
              <span className="text-sm text-navy-100">Covered towns</span>
              <input
                type="text"
                name="covered_towns"
                defaultValue={initial.distributor?.coveredTowns}
                className={inputClass}
                placeholder="Soweto, Sandton, Randburg"
              />
              <span className={hintClass}>Comma separated</span>
            </label>
          ) : (
            <div className="flex gap-4">
              <label className={labelClass + " flex-1"}>
                <span className="text-sm text-navy-100">Hub town</span>
                <input
                  type="text"
                  name="hub_town"
                  defaultValue={initial.distributor?.hubTown}
                  className={inputClass}
                />
              </label>
              <label className={labelClass + " flex-1"}>
                <span className="text-sm text-navy-100">Radius (km)</span>
                <input
                  type="number"
                  min={0}
                  name="radius_km"
                  defaultValue={initial.distributor?.radiusKm}
                  className={inputClass}
                />
              </label>
            </div>
          )}

          <label className={labelClass}>
            <span className="text-sm text-navy-100">Coverage scope</span>
            <select
              name="coverage_scope"
              defaultValue={initial.distributor?.coverageScope ?? "single_town"}
              className={inputClass}
            >
              <option value="single_town">Single town</option>
              <option value="multi_town">Multiple towns</option>
              <option value="regional">Regional</option>
              <option value="provincial">Provincial</option>
            </select>
          </label>

          <label className={labelClass}>
            <span className="text-sm text-navy-100">Minimum order quantity</span>
            <input
              type="number"
              min={0}
              name="min_order_qty"
              defaultValue={initial.distributor?.minOrderQty}
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            <span className="text-sm text-navy-100">Portfolio gaps</span>
            <textarea
              name="portfolio_gap_notes"
              defaultValue={initial.distributor?.portfolioGapNotes}
              rows={3}
              className={inputClass}
              placeholder="What kinds of products are you looking to add to your range?"
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

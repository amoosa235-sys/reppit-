"use client";

import { useState } from "react";
import Image from "next/image";
import { Button, FormInput } from "@/components/ui";

type Photo = { path: string; url: string };

type Initial = {
  category: "rep" | "printer" | "distributor" | "logistics";
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

const labelClass = "flex flex-col gap-1";
const hintClass = "text-ds-caption text-ds-mute";
const legendClass = "mb-1 text-ds-caption text-ds-mute";
const fieldTextClass = "text-ds-caption text-ds-mute";
const radioLabelClass = "flex items-center gap-2 text-ds-body text-ds-body-sm";
const fieldsetClass = "flex flex-col gap-3 rounded-ds-sm border border-ds-hairline p-ds-lg";
const selectClass =
  "font-ds-sans h-9 w-full bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md outline-none focus:border-ds-hairline-tertiary focus:ring-2 focus:ring-ds-hairline-secondary";
const textareaClass =
  "font-ds-sans w-full bg-ds-canvas-level-3 text-ds-ink text-ds-body-sm border border-ds-hairline-secondary rounded-ds-sm px-ds-md py-2 outline-none focus:border-ds-hairline-tertiary focus:ring-2 focus:ring-ds-hairline-secondary";

export function ProviderProfileForm({
  action,
  initial,
}: {
  action: (formData: FormData) => void;
  initial: Initial;
}) {
  const [category, setCategory] = useState<"rep" | "printer" | "distributor" | "logistics">(initial.category);
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
        <legend className={legendClass}>Category</legend>
        <label className={radioLabelClass}>
          <input
            type="radio"
            name="category"
            value="rep"
            checked={category === "rep"}
            onChange={() => setCategory("rep")}
          />
          Sales rep
        </label>
        <label className={radioLabelClass}>
          <input
            type="radio"
            name="category"
            value="printer"
            checked={category === "printer"}
            onChange={() => setCategory("printer")}
          />
          Poster/signage printer
        </label>
        <label className={radioLabelClass}>
          <input
            type="radio"
            name="category"
            value="distributor"
            checked={category === "distributor"}
            onChange={() => setCategory("distributor")}
          />
          Distributor
        </label>
        <label className={radioLabelClass}>
          <input
            type="radio"
            name="category"
            value="logistics"
            checked={category === "logistics"}
            onChange={() => setCategory("logistics")}
          />
          Logistics
        </label>
      </fieldset>

      <label className={labelClass}>
        <span className={fieldTextClass}>Name</span>
        <FormInput type="text" name="name" defaultValue={initial.name} required />
      </label>

      <label className={labelClass}>
        <span className={fieldTextClass}>Bio</span>
        <textarea name="bio" defaultValue={initial.bio} rows={4} className={textareaClass} />
      </label>

      <div className="flex gap-4">
        <label className={labelClass + " flex-1"}>
          <span className={fieldTextClass}>Province</span>
          <FormInput type="text" name="province" defaultValue={initial.province} />
        </label>
        <label className={labelClass + " flex-1"}>
          <span className={fieldTextClass}>Town</span>
          <FormInput type="text" name="town" defaultValue={initial.town} />
        </label>
      </div>

      {category === "rep" && (
        <fieldset className={fieldsetClass}>
          <legend className="px-1 text-ds-caption text-ds-mute">Sales rep details</legend>
          <label className={labelClass}>
            <span className={fieldTextClass}>Industries</span>
            <FormInput
              type="text"
              name="industries"
              defaultValue={initial.rep?.industries}
              placeholder="FMCG, hospitality, retail"
            />
            <span className={hintClass}>Comma separated</span>
          </label>
          <label className={labelClass}>
            <span className={fieldTextClass}>Regions covered</span>
            <FormInput
              type="text"
              name="regions_covered"
              defaultValue={initial.rep?.regionsCovered}
              placeholder="Gauteng, Western Cape"
            />
            <span className={hintClass}>Comma separated</span>
          </label>
          <label className={labelClass}>
            <span className={fieldTextClass}>Years of experience</span>
            <FormInput type="number" min={0} name="years_experience" defaultValue={initial.rep?.yearsExperience} />
          </label>
          <label className={labelClass}>
            <span className={fieldTextClass}>Languages</span>
            <FormInput
              type="text"
              name="languages"
              defaultValue={initial.rep?.languages}
              placeholder="English, isiZulu"
            />
            <span className={hintClass}>Comma separated</span>
          </label>
        </fieldset>
      )}

      {category === "printer" && (
        <fieldset className={fieldsetClass}>
          <legend className="px-1 text-ds-caption text-ds-mute">Printer details</legend>
          <label className={labelClass}>
            <span className={fieldTextClass}>Print types</span>
            <FormInput
              type="text"
              name="print_types"
              defaultValue={initial.printer?.printTypes}
              placeholder="Posters, banners, vehicle signage"
            />
            <span className={hintClass}>Comma separated</span>
          </label>
          <label className={labelClass}>
            <span className={fieldTextClass}>Turnaround (days)</span>
            <FormInput type="number" min={0} name="turnaround_days" defaultValue={initial.printer?.turnaroundDays} />
          </label>
          <label className={labelClass}>
            <span className={fieldTextClass}>Equipment</span>
            <FormInput type="text" name="equipment" defaultValue={initial.printer?.equipment} />
          </label>
          <label className={labelClass}>
            <span className={fieldTextClass}>Max print size</span>
            <FormInput type="text" name="max_print_size" defaultValue={initial.printer?.maxPrintSize} />
          </label>
        </fieldset>
      )}

      {category === "distributor" && (
        <fieldset className={fieldsetClass}>
          <legend className="px-1 text-ds-caption text-ds-mute">Distributor details</legend>
          <label className={labelClass}>
            <span className={fieldTextClass}>Product categories sought</span>
            <FormInput
              type="text"
              name="product_categories_sought"
              defaultValue={initial.distributor?.productCategoriesSought}
              placeholder="FMCG, beverages, household goods"
            />
            <span className={hintClass}>Comma separated</span>
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className={fieldTextClass}>Coverage</legend>
            <label className={radioLabelClass}>
              <input
                type="radio"
                name="coverage_method"
                value="town_list"
                checked={coverageMethod === "town_list"}
                onChange={() => setCoverageMethod("town_list")}
              />
              List of towns
            </label>
            <label className={radioLabelClass}>
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
              <span className={fieldTextClass}>Covered towns</span>
              <FormInput
                type="text"
                name="covered_towns"
                defaultValue={initial.distributor?.coveredTowns}
                placeholder="Soweto, Sandton, Randburg"
              />
              <span className={hintClass}>Comma separated</span>
            </label>
          ) : (
            <div className="flex gap-4">
              <label className={labelClass + " flex-1"}>
                <span className={fieldTextClass}>Hub town</span>
                <FormInput type="text" name="hub_town" defaultValue={initial.distributor?.hubTown} />
              </label>
              <label className={labelClass + " flex-1"}>
                <span className={fieldTextClass}>Radius (km)</span>
                <FormInput type="number" min={0} name="radius_km" defaultValue={initial.distributor?.radiusKm} />
              </label>
            </div>
          )}

          <label className={labelClass}>
            <span className={fieldTextClass}>Coverage scope</span>
            <select
              name="coverage_scope"
              defaultValue={initial.distributor?.coverageScope ?? "single_town"}
              className={selectClass}
            >
              <option value="single_town">Single town</option>
              <option value="multi_town">Multiple towns</option>
              <option value="regional">Regional</option>
              <option value="provincial">Provincial</option>
            </select>
          </label>

          <label className={labelClass}>
            <span className={fieldTextClass}>Minimum order quantity</span>
            <FormInput type="number" min={0} name="min_order_qty" defaultValue={initial.distributor?.minOrderQty} />
          </label>

          <label className={labelClass}>
            <span className={fieldTextClass}>Portfolio gaps</span>
            <textarea
              name="portfolio_gap_notes"
              defaultValue={initial.distributor?.portfolioGapNotes}
              rows={3}
              className={textareaClass}
              placeholder="What kinds of products are you looking to add to your range?"
            />
          </label>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className={legendClass}>Photos</legend>

        {initial.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {initial.photos.map((photo) => (
              <label key={photo.path} className="flex flex-col items-center gap-1 text-ds-tiny text-ds-mute">
                <div className="relative h-20 w-full overflow-hidden rounded-ds-sm">
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

        <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple className="text-ds-body-sm text-ds-body" />
        <span className={hintClass}>Up to 8 photos total, 5MB each (JPEG, PNG, WebP).</span>
      </fieldset>

      <Button type="submit" variant="primary">
        Save profile
      </Button>
    </form>
  );
}

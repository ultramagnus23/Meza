# Evaluating occupancy_detector.py accuracy (unimplemented - do this before trusting the numbers)

**Status: no accuracy evaluation has been run.** There is no precision/
recall number, no F1 score, no per-camera accuracy figure anywhere in this
repo for `occupancy_detector.py`, and this document does not invent one.
Per `docs/ML_AUDIT.md`, the detector (YOLOv8n, generic COCO-pretrained,
not fine-tuned for restaurant CCTV angles/heights) should be validated
against a pilot site's own labeled footage before its `occupancy_snapshots`
output is shown to a restaurant owner as trustworthy analytics.

## Why this matters specifically for occupancy_detector.py

The pipeline's accuracy depends heavily on things that vary per
installation and aren't captured by any generic benchmark:

- Camera mounting height/angle (overhead vs. wide-angle vs. eye-level all
  behave differently for a person detector trained mostly on eye-level
  photos).
- Table layout density and occlusion (people seated behind other people or
  furniture).
- Lighting conditions specific to the venue (dim evening service vs.
  bright daytime).
- How tightly `table_regions`/`queue_region` are drawn relative to where
  people actually sit/stand (see `supabase/migrations/002_cameras.sql`).

A published YOLOv8 COCO benchmark number would not reflect any of this -
it's a general "can this model find people in photos" number, not "does
this specific camera at this specific restaurant produce correct
`occupancy_percentage` values."

## Minimal evaluation harness (not yet built)

To honestly answer "how accurate is this at my pilot site," build:

1. **Ground truth collection**: record (or have staff log) actual
   occupied-table counts and queue length at known timestamps over a
   representative period (different hours, different days, different
   crowd levels) - at least a few hundred labeled timestamps.
2. **A comparison script** (does not exist yet) that pulls
   `occupancy_snapshots` rows at those same timestamps and computes:
   - Mean absolute error on `occupancy_percentage` and `people_count`
     against the labeled ground truth.
   - Precision/recall on `occupied_tables` per configured table region
     (did the detector correctly say table N was occupied at time T?).
   - Same for `queue_length` if the site has a configured `queue_region`.
3. **A drift check**: re-run the comparison periodically (lighting changes
   seasonally, camera can be bumped/re-aimed) rather than treating one
   evaluation as permanent.

None of this is implemented in this repo yet - there is no labeled dataset
to build it against until a pilot site actually generates one. Do not
present `occupancy_snapshots` data from this pipeline to a customer as a
validated accuracy metric until steps 1-2 above have actually been run
against that customer's own cameras.

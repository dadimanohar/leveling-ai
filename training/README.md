# leveling training stack

This optional training stack is separate from the application runtime because model training may require a GPU, large datasets and substantial disk.

Pipeline:
1. Collect from explicit source allowlists.
2. Normalize and deduplicate.
3. Score quality and retain provenance.
4. Build train/evaluation splits.
5. Run supervised fine-tuning (SFT).
6. Optionally run preference optimization.
7. Evaluate on held-out data and regression cases.
8. Promote a checkpoint only when its gate passes.
9. Retain the previous checkpoint for rollback.

Do not automatically treat arbitrary Internet pages as ground truth. The included curator is conservative by default.

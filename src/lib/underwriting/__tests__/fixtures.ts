import type { UnderwritingInput } from "../types";
import { withDefaults } from "../defaults";
import { SAMPLE_PROPERTY_INPUT } from "@/lib/data/sample";

/**
 * The canonical sample property (manually entered / illustrative), normalized
 * through `withDefaults`. Single source of truth shared with the seeded store.
 */
export const SAMPLE_PROPERTY: UnderwritingInput = withDefaults(SAMPLE_PROPERTY_INPUT);

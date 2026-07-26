import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';

/**
 * MOLECULE — item search, as a plain GET form.
 *
 * NO `"use client"`, and that is the interesting part. A native form submitting
 * to the same route means:
 *
 *   - search works with JavaScript disabled or still loading;
 *   - the result is a real URL that can be shared and bookmarked;
 *   - the page stays a server component, so the 850 KB item mapping is
 *     searched on the server and never shipped to a browser.
 *
 * The obvious alternative — a client-side typeahead over the full item list —
 * would push roughly a megabyte of JSON to every visitor to save a round trip.
 *
 * Composes two atoms for one job, holds no state, fetches nothing: a molecule.
 */

interface ItemSearchFormProps {
  /** Route the form submits to. */
  action: string;
  /** Current query, so the field survives the round trip. */
  defaultValue?: string;
  label?: string;
  placeholder?: string;
}

export function ItemSearchForm({
  action,
  defaultValue = '',
  label = 'Search items',
  placeholder = 'e.g. twisted bow, nature rune, dragon bones',
}: ItemSearchFormProps) {
  return (
    <form action={action} method="get" role="search" className="flex flex-wrap gap-2">
      <label htmlFor="item-search" className="sr-only">
        {label}
      </label>
      <Input
        id="item-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        // Search fields should not autocapitalise or autocorrect item names —
        // "abyssal whip" becoming "Abyssal Whip" is harmless, but iOS
        // autocorrecting "Zamorakian hasta" is not.
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}

export default defineAppConfig({
  title: "grate",
  ui: {
    colors: {
      primary: "amber",
      neutral: "grey",
    },
    button: {
      // Disciplined amber: the brand yellow only ever appears at the bright end
      // carrying dark text. Mid-band amber (500-800) reads as muddy mustard as
      // a fill, so solid primary buttons pin themselves to the 300-500 band in
      // both colour modes rather than following --ui-primary.
      compoundVariants: [
        {
          color: "primary",
          variant: "solid",
          class:
            "bg-amber-400 text-grey-950 hover:bg-amber-300 active:bg-amber-500 disabled:bg-amber-400/60 aria-disabled:bg-amber-400/60",
        },
      ],
    },
  },
});

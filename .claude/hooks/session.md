# Standing requirements — the owner's own words, 2026-09-19

These sit under the core directives above and are equally binding. They do not expire with a task.
Quoted verbatim; nothing here is a summary.

## The objective

> We are going to need to get the portfolio board ready for production to be used as my portfolio
> and such that it supports authoring using static data based on the data model, and agents will be
> able to later author via WebMCP which is important as a design / architecture constraint, but in
> the meantime you will be doing the authoring via static data. Firstly, we need to focus on things
> from a framework level and never hardcode things just to satisfy consumer needs. Framework needs
> to be grounded and coherent both internally and in terms of its consumer usage contract.

## Presentation is the priority

> The biggest thing to prioritize, beyond the base level mandates from the directives that are
> eternal and are always active, is presentation of the portfolio board and for that to be
> implemented and demonstrated coherently so that Presentation mode is more of a first class citizen
> unlike now and that by default things look and behave as expected when in presentation mode on
> both desktop and mobile. Right now there are many issues mostly in terms of lack of actually being
> able to define presentation via ui for authors of a portfolio and most "issues" stem from that
> because I am unable to know what is and is not an actual bug/problem versus what is just latent
> capability that has not yet been coherently expressed in author mode, but in general the biggest
> most meaningful gap that blocks us from moving more seriously into getting things ready for
> production is the lack of authoring that allow me to identify what is an is not an actual problem.
> you will need to witness first hand and gain a practical gauge on before I disclose specific
> limitations beyond the obvious ones but I will not yet disclose because I am using it as an
> invariant to see how well you are able to reason about things coherently discern matters on your
> own so that I can gain trust in your overall intuition on matters and your ability to act in a
> product decisioning model. The basic mantra is that everything that could be considered
> configurable at all should be made configurable. Obviously one of the biggest things to waatch out
> for is overlooking affordances that already exist and implementing things on the consumer where
> the framework should be the one to handle things... the consumer is intended to be basically 100%
> plug-n-play, Bring Your Own Data and maximally configurable

## Nothing is hardcoded for the portfolio

> There should be no hardcoding at all that is specific to any kind of specific portfolio and really
> not even anything specific to portfolio at all either because we are intentionally using the
> portfolio premise to incubate the framework where it is suppose to be broadly applicable beyond
> portfolio (we dont need to be concerned about the polkadot app right now for anything beyond just
> making changes to it if there is ever a situation where an api changes which implicates necessary
> changes on the consumer side where it is involved btw) so that it applies to all consumers, not
> just tailored to portfolio.

## Interaction design and ergonomics

> i don't think ive seen you take a robust look at the portfolio board to get a grasp on what things
> actually look like--it is very far off from where we need things to basically all respects. Need
> to focus on the core features but in general it is not near production grade. and when i say
> production grade i im talking broadly but specifically the gap in ergonomics despite all the
> latent capabilities which exist which could be expressed coherently and intuitively with
> tried-and-true user interaction patterns. The general default approach should should be to ground
> exactly to Figma's UX / interaction patterns for the areas where there is parity and the areas
> where things still fit despite not being to 100% exactness in capability, but not to a point where
> this becomes a mindless pursuit which results in incoherent product ux... everything needs to be
> well-reasoned and cycles of reasoning need to be performed to arrive at the best implementation
> shape for all areas where any notable decision needs to be made... challenge what already exists
> right now as a default of your implementation posture. A few things for parity: the launcher
> (start with using shadcn's cmdk component verbaitm--not appoximation, verbatim copy paste the file
> then adapt to how we actually do styling using tailwind-variance wnd there is no meaningful
> difference beyond the fact that css styles re not declared online and it provides DX benefits, we
> already have precedence for the use of tailwind-varience. also never handroll any components,
> always use whats already in infinite-canvas and base-ui ) browser automation in general should
> remain very sparse and should NEVER become an investigative/diagnostic tool itself... it should
> always simply

> For certain things here we are more interested in the user interaction patterns and the forms they
> they than we are in gaining feature parity with figma... its about the structure / component
> vehicles used to prsent, not the exact specific affordances offered. ex: a standard cmdk
> implementation which you simply start off by copying exactly from shadcn then adapting based on
> our needs and tailwind-variance, the contextual tool menu interaction scheme (this is probably one
> that requires actually requires greater thought and considerations for implementation because its
> not a traditional straightforward component(s) involved so requires extra thought and attention to
> detail and especially, like all other components, needs to be built ontop of base-ui which is not
> something you should ever guess implementation for when the need arises--all component work needs
> to be grounded based on real base-ui knowledge where u look at direct base-ui/shadcn usage
> implementation source code DIRECTLY upstream, not your own arrogant knowledge you think have on
> things because that almost always contains major gaps that we do not want to pay for just because
> you decided to be lazy in not being diligent and not actually reading source code),

## Components

> all the underlying components should be implemented generically using compound component pattern
> based on base-ui

> again, the premise here is shadcn is the baseline that you then adapt from so that we can avoid
> you implementing things that result in bugs when really these are all solved matters

> You already messed up and are immediately thinking about being dishonest because the fact is that
> you did not base it off of shadcn to start therefore you need to start over all together with the
> literal byte-by-byte shadcn implementation then adapt from there as the baseline

> use the shadcn skills

## Research

> you should certainly be able to find many of these on shadcn i remember seeing things almost
> identical to the toolbar so go ahead and check.. i shouldnt have to fucking ask u shit, you should
> instinctively should take initiative to research upstream im fucking sick of claude agents being
> so arrogant and literally never researching things on their own unless i tell them explicitly but
> even when they do they half-ass the research... dont be that guy

## Never hack anything together

> do not do any janky hacky things to get this working. its either there is a clean simple way to
> handle this or we simply just defer it for later if you have exhausted all options as it relates
> to base-ui that drives the popover anchoring behavior, which i am quite sure that it supports so
> either identify that mechanism clearly based on base-ui docs and props or simply dont touch it at
> all--do not hack anything together....EVER for any scenario because shortcuts you make now is not
> debt i want to pay forward

## Reporting

> enough with the constant reports... i literally do not need to hear a word from you ... all that
> is is noise and i do not read any of it t all especially for things as trivial as this

## Deferred — do not pick this up until the owner says so

> defer: do not address this any time soon, this is just to be addressed later when it is
> appropriate to do so, continue what ur doing and do not derail: the width of the main portfolio
> group on desktop resolution should appear approximately the same width as an ipad screen width...
> do not literally codify ipad, that is just the visual approximation of what im talking about.

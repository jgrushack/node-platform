-- Make room for two different potato dishes without changing saved recipes.
update public.nodesgiving_menu
set slots = greatest(slots, 2),
    servings = 10,
    description = 'Two potato dishes: mashed, sweet, roasted, or your own recipe. Check what others are bringing.'
where name = 'Potatoes' and category = 'Sides';

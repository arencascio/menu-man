import { supabaseServer } from "@/lib/supabase/server";

type RestaurantPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function RestaurantPage({
  params,
}: RestaurantPageProps) {
  const { slug } = await params;

  const { data: restaurant, error: restaurantError } =
    await supabaseServer
      .from("restaurants")
      .select("id, name, slug, currency")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

if (restaurantError || !restaurant) {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Restaurant not found</h1>

      <pre>
        {JSON.stringify(
          {
            slug,
            restaurantError,
            restaurant,
          },
          null,
          2
        )}
      </pre>
    </main>
  );
}

  const { data: menu, error: menuError } =
    await supabaseServer
      .from("menus")
      .select("id, name")
      .eq("restaurant_id", restaurant.id)
      .eq("is_published", true)
      .single();

  if (menuError || !menu) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>{restaurant.name}</h1>
        <p>No published menu found.</p>
      </main>
    );
  }

  const { data: sections, error: sectionsError } =
    await supabaseServer
      .from("menu_sections")
      .select(`
        id,
        name,
        description,
        sort_order,
        menu_section_items (
          sort_order,
          menu_items (
            id,
            name,
            description,
            price_cents,
            image_url
          )
        )
      `)
      .eq("menu_id", menu.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

  if (sectionsError) {
    console.error(sectionsError);

    return (
      <main style={{ padding: "2rem" }}>
        <h1>{restaurant.name}</h1>
        <p>There was a problem loading the menu.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>{restaurant.name}</h1>

      <p>
        Menu: {menu.name}
      </p>

      {sections?.map((section) => (
        <section
          key={section.id}
          style={{
            marginTop: "2rem",
          }}
        >
          <h2>{section.name}</h2>

          {section.description && (
            <p>{section.description}</p>
          )}

          {section.menu_section_items
            ?.sort(
              (a, b) =>
                a.sort_order -
                b.sort_order
            )
            .map((placement) => {
              const item =
                placement.menu_items;

              if (!item) {
                return null;
              }

              return (
                <article
                  key={item.id}
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    border:
                      "1px solid #ccc",
                  }}
                >
                  <strong>
                    {item.name}
                  </strong>

                  <div>
                    $
                    {(
                      item.price_cents /
                      100
                    ).toFixed(2)}
                  </div>

                  {item.description && (
                    <p>
                      {
                        item.description
                      }
                    </p>
                  )}
                </article>
              );
            })}
        </section>
      ))}
    </main>
  );
}
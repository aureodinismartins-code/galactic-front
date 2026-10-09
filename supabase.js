const SUPABASE_URL = "https://pamllpebsnefaraebwxe.supabase.co";
const SUPABASE_KEY = "sb_publishable__qL78ZQxUOooGCbZqHEfDw_HXxGioD2";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    async function testSupabase() {

    const { data, error } =
        await supabaseClient
            .from("players")
            .select("*");

    if (error) {

        console.error(
            "Supabase database error:",
            error
        );

        return;
    }

    console.log(
        "Supabase database working:",
        data
    );
}

testSupabase();
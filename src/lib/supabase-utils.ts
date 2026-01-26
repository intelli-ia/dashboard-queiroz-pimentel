/**
 * Utility to fetch all records from a Supabase query by iterating through pages.
 * Supabase/PostgREST typically limits results to 1000 per request.
 */
export async function fetchAll<T>(queryBuilder: any): Promise<T[]> {
    let allData: T[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await queryBuilder
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error in fetchAll:', error);
            throw error;
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < pageSize) {
                hasMore = false;
            } else {
                page++;
            }
        } else {
            hasMore = false;
        }
    }

    return allData;
}

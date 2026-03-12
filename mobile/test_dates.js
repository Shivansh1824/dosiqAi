function testDates() {
    const today = new Date();
    // In node on Mac, timezone might be IST if system is IST, or we can mock it
    const m_start_date = "2026-03-12";
    let startDate = new Date(m_start_date);
    console.log("startDate", startDate);
    console.log("today", today);
    console.log("startDate > today:", startDate > today);
}
testDates();

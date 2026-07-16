"""SQL queries registry for the dvdrental database exercises."""

from typing import Dict, List, TypedDict


class QueryDefinition(TypedDict):
    question_number: str
    question_title: str
    sql: List[str]


# A dictionary containing the 15 queries to execute on the dvdrental database
QUERIES: Dict[str, QueryDefinition] = {
    "Q1": {
        "question_number": "Q1",
        "question_title": "High Rental Rate Films",
        "sql": [
            """
            SELECT film_id, title, description, rental_rate
            FROM film
            WHERE rental_rate > 4.00
            ORDER BY title;
            """
        ],
    },
    "Q2": {
        "question_number": "Q2",
        "question_title": "Top 10 High Paying Customers",
        "sql": [
            """
            SELECT
                c.customer_id,
                c.first_name,
                c.last_name,
                c.email,
                SUM(p.amount) AS total_amount
            FROM customer c
            JOIN payment p ON c.customer_id = p.customer_id
            GROUP BY c.customer_id, c.first_name, c.last_name, c.email
            ORDER BY total_amount DESC
            LIMIT 10;
            """
        ],
    },
    "Q3": {
        "question_number": "Q3",
        "question_title": "Film Categories Revenue",
        "sql": [
            """
            SELECT
                cat.name AS category_name,
                COUNT(r.rental_id) AS total_rentals,
                SUM(p.amount) AS total_revenue
            FROM category cat
            JOIN film_category fc ON cat.category_id = fc.category_id
            JOIN film f ON fc.film_id = f.film_id
            JOIN inventory i ON f.film_id = i.film_id
            JOIN rental r ON i.inventory_id = r.inventory_id
            JOIN payment p ON r.rental_id = p.rental_id
            GROUP BY cat.name
            ORDER BY total_revenue DESC;
            """
        ],
    },
    "Q4": {
        "question_number": "Q4",
        "question_title": "Top 10 Most Rented Films",
        "sql": [
            """
            SELECT
                f.film_id,
                f.title,
                COUNT(r.rental_id) AS rental_count
            FROM film f
            JOIN inventory i ON f.film_id = i.film_id
            JOIN rental r ON i.inventory_id = r.inventory_id
            GROUP BY f.film_id, f.title
            ORDER BY rental_count DESC
            LIMIT 10;
            """
        ],
    },
    "Q5": {
        "question_number": "Q5",
        "question_title": "Average Rental Duration by Rating",
        "sql": [
            """
            SELECT
                rating,
                ROUND(AVG(rental_duration), 2) AS avg_rental_duration
            FROM film
            GROUP BY rating
            ORDER BY avg_rental_duration DESC;
            """
        ],
    },
    "Q6": {
        "question_number": "Q6",
        "question_title": "Top Actors with Over 35 Films",
        "sql": [
            """
            SELECT
                a.actor_id,
                a.first_name,
                a.last_name,
                COUNT(fa.film_id) AS film_count
            FROM actor a
            JOIN film_actor fa ON a.actor_id = fa.actor_id
            GROUP BY a.actor_id, a.first_name, a.last_name
            HAVING COUNT(fa.film_id) > 35
            ORDER BY film_count DESC;
            """
        ],
    },
    "Q7": {
        "question_number": "Q7",
        "question_title": "Unreturned Rentals List",
        "sql": [
            """
            SELECT
                r.rental_id,
                c.first_name,
                c.last_name,
                c.email,
                f.title,
                r.rental_date
            FROM rental r
            JOIN customer c ON r.customer_id = c.customer_id
            JOIN inventory i ON r.inventory_id = i.inventory_id
            JOIN film f ON i.film_id = f.film_id
            WHERE r.return_date IS NULL
            ORDER BY r.rental_date ASC
            LIMIT 20;
            """
        ],
    },
    "Q8": {
        "question_number": "Q8",
        "question_title": "Customer Rental Summary View",
        "sql": [
            "DROP VIEW IF EXISTS customer_rental_summary CASCADE;",
            """
            CREATE VIEW customer_rental_summary AS
            SELECT
                c.customer_id,
                c.first_name,
                c.last_name,
                c.email,
                COUNT(r.rental_id) AS total_rentals,
                COALESCE(SUM(p.amount), 0.00) AS total_payments
            FROM customer c
            LEFT JOIN rental r ON c.customer_id = r.customer_id
            LEFT JOIN payment p ON r.rental_id = p.rental_id
            GROUP BY c.customer_id, c.first_name, c.last_name, c.email;
            """,
            """
            SELECT customer_id, first_name, last_name, email, total_rentals, total_payments
            FROM customer_rental_summary
            ORDER BY total_rentals DESC
            LIMIT 20;
            """,
        ],
    },
    "Q9": {
        "question_number": "Q9",
        "question_title": "Film Revenue Materialized View",
        "sql": [
            "DROP MATERIALIZED VIEW IF EXISTS film_revenue_summary CASCADE;",
            """
            CREATE MATERIALIZED VIEW film_revenue_summary AS
            SELECT
                f.film_id,
                f.title,
                c.name AS category_name,
                COUNT(r.rental_id) AS rental_count,
                COALESCE(SUM(p.amount), 0.00) AS total_revenue
            FROM film f
            JOIN film_category fc ON f.film_id = fc.film_id
            JOIN category c ON fc.category_id = c.category_id
            LEFT JOIN inventory i ON f.film_id = i.film_id
            LEFT JOIN rental r ON i.inventory_id = r.inventory_id
            LEFT JOIN payment p ON r.rental_id = p.rental_id
            GROUP BY f.film_id, f.title, c.name;
            """,
            """
            SELECT title, category_name, rental_count, total_revenue
            FROM film_revenue_summary
            ORDER BY total_revenue DESC
            LIMIT 20;
            """,
        ],
    },
    "Q10": {
        "question_number": "Q10",
        "question_title": "High-Value Customers Temp Table",
        "sql": [
            "DROP TABLE IF EXISTS temp_high_value_customers;",
            """
            CREATE TEMP TABLE temp_high_value_customers AS
            SELECT customer_id, SUM(amount) AS total_spent
            FROM payment
            GROUP BY customer_id
            HAVING SUM(amount) > 150;
            """,
            """
            SELECT
                c.customer_id,
                c.first_name,
                c.last_name,
                c.email,
                thvc.total_spent
            FROM temp_high_value_customers thvc
            JOIN customer c ON thvc.customer_id = c.customer_id
            ORDER BY thvc.total_spent DESC;
            """,
        ],
    },
    "Q11": {
        "question_number": "Q11",
        "question_title": "Actor Film Count CTE",
        "sql": [
            """
            WITH actor_film_count AS (
                SELECT
                    a.actor_id,
                    a.first_name,
                    a.last_name,
                    COUNT(fa.film_id) AS film_count
                FROM actor a
                JOIN film_actor fa ON a.actor_id = fa.actor_id
                GROUP BY a.actor_id, a.first_name, a.last_name
            )
            SELECT
                actor_id,
                first_name,
                last_name,
                film_count,
                DENSE_RANK() OVER (ORDER BY film_count DESC) as rank
            FROM actor_film_count
            ORDER BY rank ASC, last_name ASC
            LIMIT 20;
            """
        ],
    },
    "Q12": {
        "question_number": "Q12",
        "question_title": "Rank Films within Categories",
        "sql": [
            """
            WITH ranked_films AS (
                SELECT
                    f.title,
                    c.name AS category_name,
                    f.rental_rate,
                    DENSE_RANK() OVER (
                        PARTITION BY c.category_id
                        ORDER BY f.rental_rate DESC, f.title ASC
                    ) AS rate_rank
                FROM film f
                JOIN film_category fc ON f.film_id = fc.film_id
                JOIN category c ON fc.category_id = c.category_id
            )
            SELECT title, category_name, rental_rate, rate_rank
            FROM ranked_films
            WHERE rate_rank <= 3
            ORDER BY category_name ASC, rate_rank ASC;
            """
        ],
    },
    "Q13": {
        "question_number": "Q13",
        "question_title": "Customers by Country",
        "sql": [
            """
            SELECT
                co.country,
                COUNT(cu.customer_id) AS customer_count
            FROM country co
            JOIN city ci ON co.country_id = ci.country_id
            JOIN address a ON ci.city_id = a.city_id
            JOIN customer cu ON a.address_id = cu.address_id
            GROUP BY co.country
            ORDER BY customer_count DESC, co.country ASC;
            """
        ],
    },
    "Q14": {
        "question_number": "Q14",
        "question_title": "Staff Performance Analysis",
        "sql": [
            """
            SELECT
                s.staff_id,
                s.first_name,
                s.last_name,
                COUNT(p.payment_id) AS total_transactions,
                SUM(p.amount) AS total_revenue
            FROM staff s
            JOIN payment p ON s.staff_id = p.staff_id
            GROUP BY s.staff_id, s.first_name, s.last_name
            ORDER BY total_revenue DESC;
            """
        ],
    },
    "Q15": {
        "question_number": "Q15",
        "question_title": "Monthly Revenue Trends",
        "sql": [
            """
            SELECT
                TO_CHAR(payment_date, 'YYYY-MM') AS payment_month,
                COUNT(payment_id) AS transaction_count,
                SUM(amount) AS monthly_revenue
            FROM payment
            GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
            ORDER BY payment_month ASC;
            """
        ],
    },
}

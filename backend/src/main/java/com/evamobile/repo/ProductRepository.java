package com.evamobile.repo;

import com.evamobile.domain.Category;
import com.evamobile.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByActiveTrueOrderByFeaturedDescNameAsc();

    List<Product> findByActiveTrueAndCategoryOrderByFeaturedDescNameAsc(Category category);

    @Query("""
            select p from Product p
            where p.active = true
              and (lower(p.name) like lower(concat('%', :q, '%'))
                or lower(p.brand) like lower(concat('%', :q, '%')))
            order by p.featured desc, p.name asc
            """)
    List<Product> search(@Param("q") String query);
}

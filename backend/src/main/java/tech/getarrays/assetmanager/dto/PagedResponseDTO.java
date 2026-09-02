package tech.getarrays.assetmanager.dto;

import lombok.Data;
import org.springframework.data.domain.Page;

import java.util.List;

@Data
public class PagedResponseDTO<T> {

    private List<T> content;

    private int page;

    private int size;

    private long totalElements;

    private int totalPages;

    private boolean first;

    private boolean last;

    public static <T> PagedResponseDTO<T> from(Page<T> page) {
        PagedResponseDTO<T> dto = new PagedResponseDTO<>();
        dto.setContent(page.getContent());
        dto.setPage(page.getNumber());
        dto.setSize(page.getSize());
        dto.setTotalElements(page.getTotalElements());
        dto.setTotalPages(page.getTotalPages());
        dto.setFirst(page.isFirst());
        dto.setLast(page.isLast());
        return dto;
    }
}

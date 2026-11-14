import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ProductionsComponent } from './productions.component';

describe('ProductionsComponent', () => {
  let component: ProductionsComponent;
  let fixture: ComponentFixture<ProductionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductionsComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductionsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
